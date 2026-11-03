import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { safeEqual } from './tokens.js';

const rz = () => config.payments;

/** Works out the final price of a plan after an optional coupon. */
export async function priceFor(plan, couponCode) {
  let amount = plan.price_paise;
  let coupon = null;
  if (couponCode) {
    coupon = await db('coupons').whereRaw('upper(code) = upper(?)', [couponCode]).first();
    const now = new Date();
    if (
      !coupon ||
      !coupon.active ||
      (coupon.expires_at && new Date(coupon.expires_at) < now) ||
      (coupon.max_redemptions != null && coupon.redeemed_count >= coupon.max_redemptions)
    ) {
      throw new HttpError(400, 'This coupon is invalid or has expired.');
    }
    if (coupon.percent_off) amount = Math.round(amount * (1 - coupon.percent_off / 100));
    if (coupon.amount_off_paise) amount -= coupon.amount_off_paise;
    amount = Math.max(100, amount); // Razorpay minimum is ₹1
  }
  return { amount, coupon };
}

async function createProviderOrder(amount, currency, receipt) {
  if (rz().mode === 'mock') return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}` };
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${rz().razorpayKeyId}:${rz().razorpayKeySecret}`).toString('base64'),
    },
    body: JSON.stringify({ amount, currency, receipt, payment_capture: 1 }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(502, data?.error?.description || 'Payment gateway error');
  return data;
}

export async function createCheckout(user, planId, couponCode) {
  const plan = await db('plans').where({ id: planId, active: true }).first();
  if (!plan) throw new HttpError(404, 'Plan not found');
  const { amount, coupon } = await priceFor(plan, couponCode);
  const [payment] = await db('payments')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      provider: rz().mode,
      amount_paise: amount,
      currency: plan.currency,
      coupon_code: coupon?.code ?? null,
      duration_days: plan.duration_days,
    })
    .returning('*');
  const order = await createProviderOrder(amount, plan.currency, payment.id.slice(0, 40));
  await db('payments').where({ id: payment.id }).update({ provider_order_id: order.id });
  return {
    paymentId: payment.id,
    orderId: order.id,
    amount,
    currency: plan.currency,
    keyId: rz().mode === 'mock' ? 'rzp_test_mock' : rz().razorpayKeyId,
    mode: rz().mode,
    plan: { id: plan.id, name: plan.name },
    prefill: { name: user.name || '', email: user.email || '', contact: user.phone || '' },
  };
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  if (rz().mode === 'mock') return signature === 'mock_signature';
  const expected = crypto.createHmac('sha256', rz().razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!rz().razorpayWebhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', rz().razorpayWebhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/**
 * Marks an order paid and extends the user's premium. Safe to call more than once
 * (client verify + webhook both call it) - only the first call extends access.
 */
export async function markOrderPaid(orderId, providerPaymentId, raw) {
  return db.transaction(async (trx) => {
    const payment = await trx('payments').where({ provider_order_id: orderId }).forUpdate().first();
    if (!payment) throw new HttpError(404, 'Order not found');
    if (payment.status === 'paid') return payment;
    const user = await trx('users').where({ id: payment.user_id }).forUpdate().first();
    const now = new Date();
    const current = user.premium_until && new Date(user.premium_until) > now ? new Date(user.premium_until) : now;
    const end = new Date(current.getTime() + payment.duration_days * 86_400_000);
    await trx('users').where({ id: user.id }).update({ premium_until: end, updated_at: now });
    const [updated] = await trx('payments')
      .where({ id: payment.id })
      .update({
        status: 'paid',
        provider_payment_id: providerPaymentId,
        period_start: current,
        period_end: end,
        raw: raw ? JSON.stringify(raw) : null,
        updated_at: now,
      })
      .returning('*');
    if (payment.coupon_code) await trx('coupons').where({ code: payment.coupon_code }).increment('redeemed_count', 1);
    await trx('notifications').insert({
      user_id: user.id,
      title: 'Welcome to Nalam Premium 🎉',
      body: `Your subscription is active until ${end.toDateString()}.`,
    });
    return updated;
  });
}
