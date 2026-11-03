import { useState } from 'react';
import { api, fmtDate, rupees } from '../api.js';
import { ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function Payments() {
  const [status, setStatus] = useState('paid');
  const [page, setPage] = useState(1);
  const list = useApi(() => api(`/admin/payments?status=${status}&page=${page}`), [status, page]);
  const refund = async (p) => {
    if (!confirm('Mark this payment as refunded? (Issue the actual refund from your Razorpay dashboard.)')) return;
    await api(`/admin/payments/${p.id}`, { method: 'PATCH', body: { status: 'refunded' } });
    list.reload();
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>Payments</h1>
      <div className="chips">{[['paid', 'Paid'], ['created', 'Pending'], ['failed', 'Failed'], ['refunded', 'Refunded'], ['', 'All']].map(([v, l]) => <button key={v} className={`chip ${status === v ? 'active' : ''}`} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}</div>
      <ErrorBox error={list.error} />
      <div className="card table-wrap">
        {list.loading && !list.data ? <Loading /> : null}
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Coupon</th><th>Status</th><th>Gateway IDs</th><th>Period</th><th /></tr></thead>
          <tbody>
            {list.data?.map((p) => (
              <tr key={p.id}>
                <td className="small">{fmtDate(p.created_at)}</td>
                <td className="small"><b>{p.user_name || '—'}</b><br />{p.user_email || p.user_phone}</td>
                <td>{p.plan_name || (p.provider === 'manual' ? 'Admin grant' : '—')}</td>
                <td><b>{rupees(p.amount_paise)}</b></td>
                <td>{p.coupon_code || '—'}</td>
                <td><span className={`badge ${p.status === 'paid' ? 'green' : p.status === 'created' ? '' : 'red'}`}>{p.status}</span></td>
                <td className="small muted">{p.provider_order_id || '—'}<br />{p.provider_payment_id || ''}</td>
                <td className="small">{p.period_start ? `${fmtDate(p.period_start)} → ${fmtDate(p.period_end)}` : '—'}</td>
                <td>{p.status === 'paid' && p.amount_paise > 0 ? <button className="btn ghost sm" onClick={() => refund(p)}>Refund</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && !list.data.length ? <p className="muted">No payments.</p> : null}
        <div className="row mt"><button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button><span className="small">Page {page}</span><button className="btn ghost sm" disabled={(list.data?.length || 0) < 50} onClick={() => setPage(page + 1)}>Next →</button></div>
      </div>
    </div>
  );
}
