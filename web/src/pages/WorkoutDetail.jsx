import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, img, today } from '../api.js';
import { Locked } from '../components/Paywall.jsx';
import { ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function WorkoutDetail() {
  const { id } = useParams();
  const w = useApi(() => api(`/workouts/${id}`, { silentPaywall: true }), [id]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(null);
  const [open, setOpen] = useState(null);

  if (w.loading) return <Loading />;
  if (w.error?.status === 402) return <Locked feature="workouts" />;
  if (w.error) return <ErrorBox error={w.error} />;
  const data = w.data;

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <h1>Workout complete!</h1>
        <p className="muted">{data.title} · {done.duration_min} min · {done.calories_burned} kcal burned</p>
        <div className="row" style={{ justifyContent: 'center' }}><Link to="/" className="btn">Back to home</Link><Link to="/workouts" className="btn ghost">More workouts</Link></div>
      </div>
    );
  }
  if (playing) return <Player workout={data} onExit={() => setPlaying(false)} onDone={setDone} />;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Link to="/workouts" className="small">← All workouts</Link>
      <img className="hero-img" src={img(data.image_url)} alt={data.title} />
      <div className="row between wrap">
        <div>
          <h1>{data.title}</h1>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge">{data.category}</span><span className="badge">{data.difficulty}</span>
            <span className="badge">⏱ {data.duration_min} min</span><span className="badge">🔥 ~{data.calories_est} kcal</span>
          </div>
        </div>
        <button className="btn" onClick={() => setPlaying(true)} disabled={!data.exercises.length}>▶ Start workout</button>
      </div>
      {data.description ? <p className="muted" style={{ margin: 0 }}>{data.description}</p> : null}
      <div className="card">
        <h3>{data.exercises.length} exercises</h3>
        {data.exercises.map((e, i) => (
          <div key={e.id}>
            <div className="ex-row" onClick={() => setOpen(open === i ? null : i)} style={{ cursor: 'pointer' }}>
              <img src={img(e.image_url)} alt={e.name} loading="lazy" />
              <div><b>{i + 1}. {e.name}</b><div className="muted small">{e.muscle_group}{e.equipment && e.equipment !== 'none' ? ` · ${e.equipment}` : ''}</div></div>
              <span className="badge green">{e.sets > 1 ? `${e.sets} × ` : ''}{e.reps ? `${e.reps} reps` : `${e.duration_sec}s`}</span>
            </div>
            {open === i && e.instructions ? <ol className="small" style={{ margin: '0 0 12px 120px', lineHeight: 1.7 }}>{e.instructions.split('\n').map((s, k) => <li key={k}>{s}</li>)}</ol> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Guided player: walks through each set with a timer (timed moves) or a "done" button (rep moves), with rest between. */
function Player({ workout, onExit, onDone }) {
  const steps = [];
  workout.exercises.forEach((e) => {
    for (let s = 1; s <= e.sets; s++) {
      steps.push({ type: 'work', ex: e, set: s });
      if (e.rest_sec) steps.push({ type: 'rest', ex: e, seconds: e.rest_sec });
    }
  });
  if (steps.at(-1)?.type === 'rest') steps.pop();

  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(null);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(Date.now());
  const step = steps[idx];
  const timed = step.type === 'rest' || !!step.ex.duration_sec;

  useEffect(() => {
    setLeft(step.type === 'rest' ? step.seconds : step.ex.duration_sec || null);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timed || paused || left == null) return;
    if (left <= 0) { next(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = async () => {
    if (idx < steps.length - 1) return setIdx(idx + 1);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const log = await api(`/workouts/${workout.id}/complete`, { method: 'POST', body: { duration_min: minutes, date: today() } });
    onDone(log);
  };
  const upcoming = steps.slice(idx + 1).find((s) => s.type === 'work');

  return (
    <div className="card">
      <div className="row between mb">
        <button className="btn ghost sm" onClick={onExit}>✕ Exit</button>
        <span className="muted small">Step {idx + 1} / {steps.length}</span>
      </div>
      <div className="bar mb"><span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
      <div className="player">
        <img src={img(step.ex.image_url)} alt={step.ex.name} style={{ opacity: step.type === 'rest' ? 0.4 : 1 }} />
        <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          {step.type === 'rest' ? (
            <>
              <span className="badge blue">Rest</span>
              <div className="timer">{left ?? 0}s</div>
              {upcoming ? <p className="muted">Next: <b>{upcoming.ex.name}</b></p> : null}
            </>
          ) : (
            <>
              <span className="badge green">Set {step.set} of {step.ex.sets}</span>
              <h2>{step.ex.name}</h2>
              {step.ex.duration_sec ? <div className="timer">{left ?? step.ex.duration_sec}s</div> : <div className="timer">× {step.ex.reps}</div>}
              {step.ex.instructions ? <p className="muted small" style={{ whiteSpace: 'pre-line' }}>{step.ex.instructions}</p> : null}
            </>
          )}
          <div className="row">
            {idx > 0 ? <button className="btn ghost" onClick={() => setIdx(idx - 1)}>⏮</button> : null}
            {timed ? <button className="btn ghost" onClick={() => setPaused(!paused)}>{paused ? '▶ Resume' : '⏸ Pause'}</button> : null}
            <button className="btn" onClick={next}>{idx === steps.length - 1 ? 'Finish 🎉' : step.type === 'rest' ? 'Skip rest' : timed ? 'Next ⏭' : 'Done ✓'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
