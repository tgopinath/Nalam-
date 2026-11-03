import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, img } from '../api.js';
import { Empty, ErrorBox, Loading, useApi } from '../components/ui.jsx';

const CATS = ['all', 'strength', 'cardio', 'hiit', 'yoga', 'stretching'];
const LEVEL = { beginner: 'green', intermediate: 'orange', advanced: 'red' };

export default function Workouts() {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const list = useApi(() => api(`/workouts?${cat !== 'all' ? `category=${cat}&` : ''}q=${encodeURIComponent(q)}`), [cat, q]);
  const history = useApi(() => api('/workout-history'), []);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <h2 style={{ margin: 0 }}>Workouts</h2>
        <input placeholder="Search workouts" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
      </div>
      <div className="chips">{CATS.map((c) => <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.loading && !list.data ? <Loading /> : null}
      <ErrorBox error={list.error} />
      <div className="cards">
        {list.data?.map((w) => (
          <Link key={w.id} to={`/workouts/${w.id}`} className="media-card">
            <img src={img(w.image_url)} alt={w.title} loading="lazy" />
            {w.locked ? <span className="lock-overlay">🔒 Premium</span> : !w.is_premium ? <span className="lock-overlay" style={{ background: 'var(--brand)' }}>Free</span> : null}
            <div className="body">
              <b>{w.title}</b>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className={`badge ${LEVEL[w.difficulty]}`}>{w.difficulty}</span>
                <span className="badge">⏱ {w.duration_min} min</span>
                <span className="badge">🔥 {w.calories_est} kcal</span>
                <span className="badge">{w.exercise_count} exercises</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {list.data && !list.data.length ? <Empty>No workouts match.</Empty> : null}
      {history.data?.length ? (
        <div className="card">
          <h3>Recent activity</h3>
          <div className="list">
            {history.data.slice(0, 8).map((h) => (
              <div className="list-item" key={h.id}><span>✅ {h.title}</span><span className="muted small">{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {h.duration_min} min · {h.calories_burned} kcal</span></div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
