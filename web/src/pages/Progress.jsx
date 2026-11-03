import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { BarChart, LineChart, Loading, useApi } from '../components/ui.jsx';

export default function Progress() {
  const { user, can } = useAuth();
  const [days, setDays] = useState(30);
  const weights = useApi(() => api(`/weight?days=${days}`), [days]);
  const insights = useApi(() => (can('insights') ? api('/me/insights', { silentPaywall: true }) : null), []);
  const ins = insights.data;
  const pts = (rows) => rows?.map((r) => ({ x: r.date, y: Number(r.value) })) || [];
  const latest = weights.data?.at(-1)?.weight_kg ?? user.weight_kg;
  const first = weights.data?.[0]?.weight_kg;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h2 style={{ margin: 0 }}>Progress</h2>
      <div className="grid grid-4">
        <div className="card stat"><span className="muted small">Current</span><b>{latest ?? '—'} kg</b></div>
        <div className="card stat"><span className="muted small">Target</span><b>{user.target_weight_kg ?? '—'} kg</b></div>
        <div className="card stat"><span className="muted small">Change ({days}d)</span><b>{first != null && latest != null ? `${(latest - first > 0 ? '+' : '')}${(latest - first).toFixed(1)} kg` : '—'}</b></div>
        <div className="card stat"><span className="muted small">BMI</span><b>{user.bmi?.value ?? '—'}</b><span className="small muted">{user.bmi?.category}</span></div>
      </div>
      <div className="card">
        <div className="row between"><h3>Weight</h3><div className="chips">{[30, 90, 365].map((d) => <button key={d} className={`chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d === 365 ? '1y' : `${d}d`}</button>)}</div></div>
        {weights.loading ? <Loading /> : <LineChart points={weights.data?.map((w) => ({ x: w.date, y: w.weight_kg }))} />}
      </div>

      {!can('insights') ? (
        <div className="card" style={{ textAlign: 'center' }}><h3>📊 Weekly insights are a Premium feature</h3><Link to="/premium" className="btn sm">Upgrade</Link></div>
      ) : !ins ? <Loading /> : (
        <>
          <div className="card">
            <h3>💡 This week's tips</h3>
            <ul className="check-list">{ins.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="grid grid-2">
            <div className="card"><div className="row between"><h3>Calories</h3><span className="muted small">avg {ins.averages.calories} kcal</span></div><BarChart points={pts(ins.series.calories)} target={user.calorie_target} /></div>
            <div className="card"><div className="row between"><h3>Water</h3><span className="muted small">avg {ins.averages.water_ml} ml</span></div><BarChart points={pts(ins.series.water)} target={user.water_target_ml} color="var(--blue)" /></div>
            <div className="card"><div className="row between"><h3>Steps</h3><span className="muted small">avg {ins.averages.steps}</span></div><BarChart points={pts(ins.series.steps)} target={user.step_target} color="var(--accent)" /></div>
            <div className="card"><div className="row between"><h3>Sleep</h3><span className="muted small">avg {ins.averages.sleep_hours} h</span></div><BarChart points={pts(ins.series.sleep)} target={8} color="var(--violet)" /></div>
          </div>
        </>
      )}
    </div>
  );
}
