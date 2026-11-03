import { Link } from 'react-router-dom';
import { api, rupees } from '../api.js';
import { BarChart, ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function Overview() {
  const s = useApi(() => api('/admin/stats'), []);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} />;
  const d = s.data;
  const last14 = d.daily.slice(-14);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>Overview</h1>
      <div className="grid grid-4">
        <Stat label="Total users" value={d.users} sub={`+${d.new_this_week} this week`} />
        <Stat label="Premium subscribers" value={d.premium} sub="active paid plans" color="var(--brand)" />
        <Stat label="On free trial" value={d.trial} sub="potential subscribers" color="var(--accent)" />
        <Stat label="Trial ended (free)" value={d.expired} sub="upsell opportunity" color="var(--red)" />
        <Stat label="Revenue this month" value={rupees(d.revenue_month_paise)} />
        <Stat label="Lifetime revenue" value={rupees(d.revenue_paise)} />
        <Stat label="Conversion" value={`${d.users ? Math.round((d.premium / d.users) * 100) : 0}%`} sub="users on premium" />
        <Link to="/admin/coach" className="card stat" style={{ color: 'inherit' }}><span className="muted small">Chats awaiting reply</span><b style={{ fontSize: 26, color: d.open_chats ? 'var(--red)' : undefined }}>{d.open_chats}</b><span className="small">Open inbox →</span></Link>
      </div>
      <div className="grid grid-2">
        <div className="card"><h3>Sign-ups (14 days)</h3><BarChart points={last14.map((x) => ({ x: x.date, y: x.signups }))} /></div>
        <div className="card"><h3>Revenue ₹ (14 days)</h3><BarChart points={last14.map((x) => ({ x: x.date, y: x.revenue_paise / 100 }))} color="var(--accent)" /></div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, sub, color }) => (
  <div className="card stat"><span className="muted small">{label}</span><b style={{ fontSize: 26, color }}>{value}</b>{sub ? <span className="muted small">{sub}</span> : null}</div>
);
