import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { createCheckout, markOrderPaid, priceFor, verifyCheckoutSignature, verifyWebhookSignature } from '../services/payments.js';
import { hmac, safeEqual } from '../services/tokens.js';
import { sessionPayload } from '../services/users.js';

export const subscriptionRouter = Router();

subscriptionRouter.get('/plans', async (req, res) => {
  res.json(await db('plans').where({ active: true }).orderBy('sort_order'));
});

subscriptionRouter.post('/coupon', requireAuth, async (req, res) => {
  const { planId, code } = z.object({ planId: z.coerce.number().int(), code: z.string().trim().min(1).max(40) }).parse(req.body);
  const plan = await db('plans').where({ id: planId, active: true }).first();
  if (!plan) throw new HttpError(404, 'Plan not found');
  const { amount, coupon } = await priceFor(plan, code);
  res.json({ code: coupon.code, original: plan.price_paise, amount });
});

subscriptionRouter.post('/checkout', requireAuth, async (req, res) => {
  const { planId, coupon } = z.object({ planId: z.coerce.number().int(), coupon: z.string().trim().max(40).optional() }).parse(req.body);
  const checkout = await createCheckout(req.user, planId, coupon || undefined);
  // Hosted checkout URL - used by the Android app (opens in a browser tab) so no native SDK is needed.
  const sig = hmac(`pay:${checkout.paymentId}`);
  checkout.hostedUrl = `${config.apiPublicUrl}/pay/${checkout.paymentId}?sig=${sig}`;
  res.json(checkout);
});

const verifySchema = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() });

subscriptionRouter.post('/verify', requireAuth, async (req, res) => {
  const b = verifySchema.parse(req.body);
  const payment = await db('payments').where({ provider_order_id: b.razorpay_order_id, user_id: req.user.id }).first();
  if (!payment) throw new HttpError(404, 'Order not found');
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    await db('payments').where({ id: payment.id }).update({ status: 'failed', note: 'signature mismatch' });
    throw new HttpError(400, 'Payment verification failed');
  }
  await markOrderPaid(b.razorpay_order_id, b.razorpay_payment_id, b);
  const user = await db('users').where({ id: req.user.id }).first();
  res.json(await sessionPayload(user));
});

subscriptionRouter.get('/history', requireAuth, async (req, res) => {
  const rows = await db('payments as p')
    .leftJoin('plans as pl', 'pl.id', 'p.plan_id')
    .where('p.user_id', req.user.id)
    .whereNot('p.status', 'created')
    .orderBy('p.created_at', 'desc')
    .select('p.id', 'p.status', 'p.amount_paise', 'p.currency', 'p.period_start', 'p.period_end', 'p.created_at', 'p.provider', 'pl.name as plan_name');
  res.json(rows);
});

/* ---------- Razorpay webhook (configure URL: {API}/api/webhooks/razorpay) ---------- */
export async function razorpayWebhook(req, res) {
  const raw = req.body; // Buffer (express.raw)
  if (!verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) return res.status(400).json({ error: 'bad signature' });
  const event = JSON.parse(raw.toString('utf8'));
  const entity = event?.payload?.payment?.entity;
  if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.order_id) {
    await markOrderPaid(entity.order_id, entity.id, event).catch((e) => {
      if (e.status !== 404) throw e;
    });
  } else if (event.event === 'payment.failed' && entity?.order_id) {
    await db('payments').where({ provider_order_id: entity.order_id, status: 'created' }).update({ status: 'failed' });
  } else if (event.event === 'refund.processed') {
    const pid = event?.payload?.refund?.entity?.payment_id;
    if (pid) await db('payments').where({ provider_payment_id: pid }).update({ status: 'refunded' });
  }
  res.json({ ok: true });
}

/* ---------- Hosted checkout page (Android app + any client without the JS SDK) ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function hostedCheckoutPage(req, res) {
  const { id } = req.params;
  const sig = String(req.query.sig || '');
  if (!z.uuid().safeParse(id).success || !safeEqual(sig, hmac(`pay:${id}`))) return res.status(404).send('Not found');
  const p = await db('payments as p').join('users as u', 'u.id', 'p.user_id').leftJoin('plans as pl', 'pl.id', 'p.plan_id')
    .where('p.id', id).select('p.*', 'u.name', 'u.email', 'u.phone', 'pl.name as plan_name').first();
  if (!p) return res.status(404).send('Not found');
  // Where to send the user afterwards: the app's deep link (nalam:// in release builds, exp:// in Expo Go).
  const ret = String(req.query.return || 'nalam://payment');
  const back = /^(nalam|exp|exps):\/\/[\w./:@%?&=-]*$/.test(ret) ? ret : 'nalam://payment';
  const done = `${back}${back.includes('?') ? '&' : '?'}status=`;
  const opts = {
    key: config.payments.mode === 'mock' ? 'rzp_test_mock' : config.payments.razorpayKeyId,
    amount: p.amount_paise,
    currency: p.currency,
    name: 'Nalam',
    description: p.plan_name,
    order_id: p.provider_order_id,
    prefill: { name: p.name || '', email: p.email || '', contact: p.phone || '' },
    theme: { color: '#16a34a' },
  };
  res.set('Content-Security-Policy', "default-src 'self' https://*.razorpay.com; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'unsafe-inline'; frame-src https://*.razorpay.com; connect-src 'self' https://*.razorpay.com; img-src * data:");
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nalam Premium</title><style>body{font-family:system-ui,sans-serif;background:#f0fdf4;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.card{background:#fff;border-radius:16px;padding:28px;max-width:360px;width:100%;box-shadow:0 8px 30px #0001;text-align:center}
button{background:#16a34a;color:#fff;border:0;border-radius:10px;padding:14px 20px;font-size:16px;width:100%;cursor:pointer}h1{color:#15803d;margin:0 0 4px}</style></head>
<body><div class="card"><h1>Nalam</h1><p>${esc(p.plan_name)}</p><h2>₹${(p.amount_paise / 100).toFixed(2)}</h2>
<button id="pay">Pay securely</button><p id="msg" style="color:#666;font-size:14px"></p></div>
${config.payments.mode === 'mock' ? '' : '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>'}
<script>
const opts=${JSON.stringify(opts).replace(/</g, '\\u003c')};const mock=${config.payments.mode === 'mock'};
const msg=document.getElementById('msg');
async function finish(r){msg.textContent='Verifying payment...';
 const res=await fetch('/pay/${id}/complete?sig=${sig}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
 const ok=res.ok;msg.textContent=ok?'Payment successful! Returning to the app...':'Payment could not be verified.';
 location.href=${JSON.stringify(done)}+(ok?'success':'failed');}
document.getElementById('pay').onclick=function(){
 if(mock){return finish({razorpay_order_id:opts.order_id,razorpay_payment_id:'pay_mock_'+Date.now(),razorpay_signature:'mock_signature'});}
 const rz=new Razorpay(Object.assign({},opts,{handler:finish,modal:{ondismiss:function(){location.href=${JSON.stringify(done)}+'cancelled'}}}));rz.open();};
</script></body></html>`);
}

export async function hostedCheckoutComplete(req, res) {
  const { id } = req.params;
  if (!z.uuid().safeParse(id).success || !safeEqual(String(req.query.sig || ''), hmac(`pay:${id}`))) return res.status(404).json({ error: 'Not found' });
  const b = verifySchema.parse(req.body);
  const payment = await db('payments').where({ id, provider_order_id: b.razorpay_order_id }).first();
  if (!payment) throw new HttpError(404, 'Order not found');
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) throw new HttpError(400, 'Payment verification failed');
  await markOrderPaid(b.razorpay_order_id, b.razorpay_payment_id, b);
  res.json({ ok: true });
}
