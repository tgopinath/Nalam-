import { useState } from 'react';
import { api, fmtDate, rupees } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../components/ui.jsx';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your connection.'));
    document.body.appendChild(s);
  });
}

export default function Subscribe() {
  const { config, access, setSession } = useAuth();
  const plans = config?.plans || [];
  const [chosen, setPlanId] = useState(null);
  const planId = chosen ?? plans.find((p) => p.interval === 'year')?.id ?? plans[0]?.id; // default once config has loaded
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const history = useApi(() => api('/subscription/history'), []);
  const plan = plans.find((p) => p.id === planId);

  const applyCoupon = async () => {
    setMsg(null);
    try { setApplied(await api('/subscription/coupon', { method: 'POST', body: { planId, code: coupon } })); } catch (e) { setApplied(null); setMsg({ err: e.message }); }
  };

  const verify = async (r) => {
    const session = await api('/subscription/verify', { method: 'POST', body: r });
    setSession(session);
    setMsg({ ok: `Payment successful! Premium is active until ${fmtDate(session.access.premiumUntil)} 🎉` });
    history.reload();
  };

  const pay = async () => {
    setBusy(true); setMsg(null);
    try {
      const order = await api('/subscription/checkout', { method: 'POST', body: { planId, coupon: applied?.code } });
      if (order.mode === 'mock') {
        if (confirm(`TEST MODE: simulate a successful payment of ${rupees(order.amount)}?`)) {
          await verify({ razorpay_order_id: order.orderId, razorpay_payment_id: `pay_mock_${Date.now()}`, razorpay_signature: 'mock_signature' });
        }
        return;
      }
      await loadRazorpay();
      await new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
          name: 'Nalam', description: `${order.plan.name} plan`, prefill: order.prefill, theme: { color: '#16a34a' },
          handler: async (r) => { try { await verify(r); } catch (e) { setMsg({ err: e.message }); } resolve(); },
          modal: { ondismiss: resolve },
        });
        rz.on('payment.failed', (r) => setMsg({ err: r.error?.description || 'Payment failed' }));
        rz.open();
      });
    } catch (e) { setMsg({ err: e.message }); } finally { setBusy(false); }
  };

  const monthly = plans.find((p) => p.interval === 'month');
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a 50%,#84cc16)', color: '#fff', border: 0 }}>
        <h1 style={{ color: '#fff' }}>Nalam Premium ⭐</h1>
        <p style={{ margin: 0, opacity: 0.95 }}>
          {access.status === 'premium' ? `You're Premium until ${fmtDate(access.premiumUntil)}. Renew any time — extra days are added on top.`
            : access.status === 'trial' ? `You're on your free trial — ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left. Subscribe to keep everything after it ends.`
            : 'Your free trial has ended. Choose a plan to unlock every feature.'}
        </p>
      </div>

      <div className="grid grid-2">
        {plans.map((p) => {
          const perMonth = p.interval === 'year' ? Math.round(p.price_paise / 12) : null;
          const save = p.interval === 'year' && monthly ? Math.round((1 - p.price_paise / (monthly.price_paise * 12)) * 100) : null;
          return (
            <div key={p.id} className={`plan ${planId === p.id ? 'selected' : ''}`} onClick={() => { setPlanId(p.id); setApplied(null); }} role="radio" aria-checked={planId === p.id} tabIndex={0}>
              {save > 0 ? <span className="tag">SAVE {save}%</span> : null}
              <h3>{p.name}</h3>
              <div><span className="price">{rupees(p.price_paise)}</span>{p.mrp_paise ? <span className="mrp">{rupees(p.mrp_paise)}</span> : null}</div>
              <div className="muted small">{perMonth ? `Just ${rupees(perMonth)}/month · billed yearly` : `${p.duration_days} days access`}</div>
              <ul className="check-list">{p.highlights?.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          );
        })}
      </div>

      {plan ? (
        <div className="card stack">
          <div className="row wrap">
            <input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} style={{ maxWidth: 220 }} />
            <button className="btn ghost" onClick={applyCoupon} disabled={!coupon}>Apply</button>
            {applied ? <span className="badge green">{applied.code} applied · you pay {rupees(applied.amount)}</span> : null}
          </div>
          {msg?.ok ? <div className="success">{msg.ok}</div> : null}
          {msg?.err ? <div className="error">{msg.err}</div> : null}
          <button className="btn block" onClick={pay} disabled={busy}>{busy ? 'Opening secure checkout…' : `Pay ${rupees(applied?.amount ?? plan.price_paise)} · ${plan.name}`}</button>
          <span className="muted small" style={{ textAlign: 'center' }}>🔒 Secure payments by Razorpay · UPI, cards, net banking & wallets</span>
        </div>
      ) : <div className="card muted">No plans available right now.</div>}

      <div className="card">
        <h3>What you get</h3>
        <ul className="check-list">{Object.values(config?.features || {}).map((f) => <li key={f}>{f}</li>)}</ul>
      </div>

      {history.data?.length ? (
        <div className="card">
          <h3>Billing history</h3>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Valid till</th></tr></thead>
            <tbody>{history.data.map((h) => (
              <tr key={h.id}><td>{fmtDate(h.created_at)}</td><td>{h.plan_name || 'Complimentary'}</td><td>{rupees(h.amount_paise)}</td>
                <td><span className={`badge ${h.status === 'paid' ? 'green' : 'red'}`}>{h.status}</span></td><td>{h.period_end ? fmtDate(h.period_end) : '—'}</td></tr>
            ))}</tbody></table></div>
        </div>
      ) : null}
    </div>
  );
}
