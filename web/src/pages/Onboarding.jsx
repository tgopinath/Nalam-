import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const GOALS = [['lose', '🔥 Lose weight'], ['maintain', '⚖️ Stay fit'], ['gain', '💪 Gain muscle']];
const ACTIVITY = [
  ['sedentary', 'Sedentary', 'Desk job, little exercise'],
  ['light', 'Lightly active', 'Light exercise 1-3 days/week'],
  ['moderate', 'Moderately active', 'Exercise 3-5 days/week'],
  ['active', 'Very active', 'Hard exercise 6-7 days/week'],
  ['very_active', 'Athlete', 'Physical job or 2x training'],
];
const DIETS = [['veg', '🥦 Vegetarian'], ['non_veg', '🍗 Non-veg'], ['eggetarian', '🥚 Eggetarian'], ['vegan', '🌱 Vegan']];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: user?.name || '', gender: user?.gender || '', dob: user?.dob || '', height_cm: user?.height_cm || '', weight_kg: user?.weight_kg || '',
    target_weight_kg: user?.target_weight_kg || '', activity_level: user?.activity_level || 'light', goal: user?.goal || 'lose', diet_pref: user?.diet_pref || 'veg',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const steps = [
    { title: "What's your goal?", valid: !!f.goal, body: (
      <div className="stack">{GOALS.map(([v, l]) => <button type="button" key={v} className={`plan ${f.goal === v ? 'selected' : ''}`} onClick={() => set('goal', v)}><b>{l}</b></button>)}</div>
    ) },
    { title: 'Tell us about you', valid: f.name && f.gender && f.dob, body: (
      <div className="stack">
        <label className="field">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field">Gender
          <div className="chips">{['male', 'female', 'other'].map((g) => <button type="button" key={g} className={`chip ${f.gender === g ? 'active' : ''}`} onClick={() => set('gender', g)}>{g}</button>)}</div>
        </label>
        <label className="field">Date of birth<input type="date" max={new Date(Date.now() - 10 * 365 * 864e5).toISOString().slice(0, 10)} value={f.dob} onChange={(e) => set('dob', e.target.value)} /></label>
      </div>
    ) },
    { title: 'Your body', valid: f.height_cm && f.weight_kg && f.target_weight_kg, body: (
      <div className="grid grid-2">
        <label className="field">Height (cm)<input type="number" inputMode="decimal" value={f.height_cm} onChange={(e) => set('height_cm', e.target.value)} /></label>
        <label className="field">Current weight (kg)<input type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></label>
        <label className="field">Target weight (kg)<input type="number" inputMode="decimal" step="0.1" value={f.target_weight_kg} onChange={(e) => set('target_weight_kg', e.target.value)} /></label>
      </div>
    ) },
    { title: 'How active are you?', valid: !!f.activity_level, body: (
      <div className="stack">{ACTIVITY.map(([v, l, d]) => (
        <button type="button" key={v} className={`plan ${f.activity_level === v ? 'selected' : ''}`} style={{ textAlign: 'left', padding: 14 }} onClick={() => set('activity_level', v)}>
          <b>{l}</b><div className="small muted">{d}</div>
        </button>
      ))}</div>
    ) },
    { title: 'Food preference', valid: !!f.diet_pref, body: (
      <div className="grid grid-2">{DIETS.map(([v, l]) => <button type="button" key={v} className={`plan ${f.diet_pref === v ? 'selected' : ''}`} onClick={() => set('diet_pref', v)}><b>{l}</b></button>)}</div>
    ) },
  ];

  const next = async () => {
    if (step < steps.length - 1) return setStep(step + 1);
    setBusy(true); setError('');
    try {
      const res = await api('/me/profile', { method: 'PATCH', body: f });
      setUser(res.user);
      setResult(res.user);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="center-screen">
        <div className="card narrow stack" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🎯</div>
          <h2>Your daily plan is ready</h2>
          <div className="grid grid-2">
            <div className="card"><div className="muted small">Calories</div><b style={{ fontSize: 24 }}>{result.calorie_target}</b> kcal</div>
            <div className="card"><div className="muted small">Water</div><b style={{ fontSize: 24 }}>{(result.water_target_ml / 1000).toFixed(1)}</b> L</div>
            <div className="card"><div className="muted small">Protein</div><b style={{ fontSize: 24 }}>{result.protein_g}</b> g</div>
            <div className="card"><div className="muted small">BMI</div><b style={{ fontSize: 24 }}>{result.bmi?.value}</b> <span className="small">{result.bmi?.category}</span></div>
          </div>
          <button className="btn block" onClick={() => nav('/')}>Let's go 🚀</button>
        </div>
      </div>
    );
  }

  const s = steps[step];
  return (
    <div className="center-screen">
      <div className="card narrow stack">
        <div className="bar"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <span className="muted small">Step {step + 1} of {steps.length}</span>
        <h2>{s.title}</h2>
        {s.body}
        {error ? <div className="error">{error}</div> : null}
        <div className="row">
          {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button> : null}
          <button className="btn block" disabled={!s.valid || busy} onClick={next}>{step === steps.length - 1 ? (busy ? 'Saving…' : 'Finish') : 'Continue'}</button>
        </div>
      </div>
    </div>
  );
}
