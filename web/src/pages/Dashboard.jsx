import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, img, today } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Bar, ErrorBox, LineChart, Loading, Modal, Ring, useApi } from '../components/ui.jsx';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

export default function Dashboard() {
  const { can, setPaywall } = useAuth();
  const [date, setDate] = useState(today());
  const dash = useApi(() => api(`/me/dashboard?date=${date}`), [date]);
  const workouts = useApi(() => api('/workouts'), []);
  const [modal, setModal] = useState(null);

  if (dash.loading && !dash.data) return <Loading />;
  if (dash.error) return <ErrorBox error={dash.error} />;
  const d = dash.data;
  const t = d.targets;
  const eaten = Math.round(d.food?.calories || 0);
  const left = Math.max(0, (t.calories || 0) - eaten + d.burned);

  const addWater = async (ml) => {
    const r = await api('/water', { method: 'POST', body: { amount_ml: ml, date } });
    dash.setData({ ...d, water_ml: r.total_ml });
  };
  const gated = (feature, fn) => () => (can(feature) ? fn() : setPaywall({ error: 'This is a Premium feature.' }));
  const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 };
  const suggestion = workouts.data?.filter((w) => !w.locked).sort((a, b) => LEVEL[a.difficulty] - LEVEL[b.difficulty])[0];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div className="row">
          <span className="badge orange">🔥 {d.streak}-day streak</span>
        </div>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row between"><h3>Calories</h3><Link to="/food" className="small">Log food →</Link></div>
          {d.food ? (
            <div className="row wrap" style={{ gap: 24, justifyContent: 'space-around' }}>
              <Ring value={eaten} max={(t.calories || 2000) + d.burned}>
                <b>{left}</b><span className="small muted">kcal left</span>
              </Ring>
              <div className="stack" style={{ minWidth: 180, flex: 1 }}>
                <div className="row between small"><span>🍽️ Eaten</span><b>{eaten} kcal</b></div>
                <div className="row between small"><span>🔥 Burned</span><b>{d.burned} kcal</b></div>
                <div className="row between small"><span>🎯 Goal</span><b>{t.calories || '—'} kcal</b></div>
                <Macro label="Protein" v={d.food.protein} max={t.protein} color="var(--violet)" />
                <Macro label="Carbs" v={d.food.carbs} max={t.carbs} color="var(--amber)" />
                <Macro label="Fat" v={d.food.fat} max={t.fat} color="var(--blue)" />
              </div>
            </div>
          ) : <LockedTile text="Track calories & macros with Premium" />}
        </div>

        <div className="card">
          <div className="row between"><h3>💧 Water</h3><span className="muted small">{(d.water_ml / 1000).toFixed(2)} / {(t.water_ml / 1000).toFixed(1)} L</span></div>
          <div className="row wrap" style={{ gap: 6, margin: '14px 0' }}>
            {Array.from({ length: Math.ceil((t.water_ml || 2500) / 250) }).map((_, i) => (
              <span key={i} style={{ fontSize: 26, opacity: i < Math.floor(d.water_ml / 250) ? 1 : 0.2 }}>🥛</span>
            ))}
          </div>
          <Bar value={d.water_ml} max={t.water_ml} color="var(--blue)" />
          <div className="row mt">
            <button className="btn soft" onClick={() => addWater(-250)} disabled={!d.water_ml}>−</button>
            <button className="btn block" style={{ background: 'var(--blue)' }} onClick={() => addWater(250)}>+ 1 glass (250 ml)</button>
            <button className="btn soft" onClick={() => addWater(500)}>+500</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <Tile ico="👟" bg="#fff7ed" label="Steps" value={d.steps == null ? '🔒' : d.steps.toLocaleString('en-IN')} sub={`Goal ${t.steps?.toLocaleString('en-IN')}`}
          onClick={gated('steps', () => setModal('steps'))} bar={d.steps != null ? [d.steps, t.steps, 'var(--accent)'] : null} />
        <Tile ico="😴" bg="#eef2ff" label="Sleep" value={d.sleep == null ? (can('sleep') ? '—' : '🔒') : `${d.sleep.hours} h`} sub="Tap to log" onClick={gated('sleep', () => setModal('sleep'))} />
        <Tile ico={d.mood ? MOODS[d.mood.mood - 1] : '🙂'} bg="#fef9c3" label="Mood" value={d.mood ? ['Low', 'Meh', 'Okay', 'Good', 'Great'][d.mood.mood - 1] : can('sleep') ? '—' : '🔒'} sub="How do you feel?" onClick={gated('sleep', () => setModal('mood'))} />
        <Tile ico="⚖️" bg="#dcfce7" label="Weight" value={d.weights.length ? `${d.weights.at(-1).weight_kg} kg` : '—'} sub="Tap to update" onClick={() => setModal('weight')} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row between"><h3>Weight trend</h3><Link to="/progress" className="small">Details →</Link></div>
          <LineChart points={d.weights.map((w) => ({ x: w.date, y: w.weight_kg }))} unit="" />
        </div>
        <div className="card">
          <div className="row between"><h3>Today's activity</h3><Link to="/workouts" className="small">All workouts →</Link></div>
          {d.workouts?.length ? (
            <div className="list">{d.workouts.map((w, i) => <div key={i} className="list-item"><span>✅ {w.title}</span><span className="muted small">{w.duration_min} min · {w.calories_burned} kcal</span></div>)}</div>
          ) : suggestion ? (
            <Link to={`/workouts/${suggestion.id}`} className="media-card mt">
              <img src={img(suggestion.image_url)} alt={suggestion.title} loading="lazy" />
              <div className="body"><b>Suggested: {suggestion.title}</b><span className="muted small">{suggestion.duration_min} min · {suggestion.difficulty}</span></div>
            </Link>
          ) : <p className="muted">No workouts logged yet.</p>}
        </div>
      </div>

      {modal ? <QuickLog kind={modal} date={date} onClose={() => setModal(null)} onSaved={() => { setModal(null); dash.reload(); }} /> : null}
    </div>
  );
}

function Macro({ label, v, max, color }) {
  return (
    <div>
      <div className="row between small"><span>{label}</span><span className="muted">{Math.round(v)} / {max || '—'} g</span></div>
      <Bar value={v} max={max} color={color} />
    </div>
  );
}

function Tile({ ico, bg, label, value, sub, onClick, bar }) {
  return (
    <button className="card tile" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
      <div className="ico" style={{ background: bg }}>{ico}</div>
      <div className="stat"><span className="muted small">{label}</span><b>{value}</b><span className="muted small">{sub}</span></div>
      {bar ? <Bar value={bar[0]} max={bar[1]} color={bar[2]} /> : null}
    </button>
  );
}

const LockedTile = ({ text }) => <div className="empty"><div style={{ fontSize: 36 }}>🔒</div><p>{text}</p><Link className="btn sm" to="/premium">Upgrade</Link></div>;

function QuickLog({ kind, date, onClose, onSaved }) {
  const [v, setV] = useState({ steps: '', hours: '', quality: 3, mood: 4, weight_kg: '' });
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { steps: { steps: v.steps }, sleep: { hours: v.hours, quality: v.quality }, mood: { mood: v.mood }, weight: { weight_kg: v.weight_kg } }[kind];
      await api(`/${kind}`, { method: 'PUT', body: { ...body, date } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  const title = { steps: '👟 Log steps', sleep: '😴 Log sleep', mood: '🙂 How are you feeling?', weight: '⚖️ Log weight' }[kind];
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        {kind === 'steps' ? <label className="field">Steps today<input type="number" min="0" value={v.steps} onChange={(e) => setV({ ...v, steps: e.target.value })} autoFocus required /></label> : null}
        {kind === 'weight' ? <label className="field">Weight (kg)<input type="number" step="0.1" value={v.weight_kg} onChange={(e) => setV({ ...v, weight_kg: e.target.value })} autoFocus required /></label> : null}
        {kind === 'sleep' ? (
          <>
            <label className="field">Hours slept<input type="number" step="0.5" min="0" max="24" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} autoFocus required /></label>
            <label className="field">Sleep quality<div className="emoji-scale">{['😫', '😪', '😐', '😌', '🤩'].map((m, i) => <button type="button" key={m} className={v.quality === i + 1 ? 'active' : ''} onClick={() => setV({ ...v, quality: i + 1 })}>{m}</button>)}</div></label>
          </>
        ) : null}
        {kind === 'mood' ? <div className="emoji-scale">{MOODS.map((m, i) => <button type="button" key={m} className={v.mood === i + 1 ? 'active' : ''} onClick={() => setV({ ...v, mood: i + 1 })}>{m}</button>)}</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <button className="btn block">Save</button>
      </form>
    </Modal>
  );
}
