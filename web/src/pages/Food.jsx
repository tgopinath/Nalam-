import { useEffect, useState } from 'react';
import { api, today } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Locked } from '../components/Paywall.jsx';
import { Bar, ErrorBox, Loading, Modal, useApi } from '../components/ui.jsx';

const MEALS = [['breakfast', '🌅 Breakfast'], ['lunch', '☀️ Lunch'], ['snacks', '🍪 Snacks'], ['dinner', '🌙 Dinner']];

export default function Food() {
  const { can, user } = useAuth();
  const [date, setDate] = useState(today());
  const logs = useApi(() => (can('food_log') ? api(`/food-logs?date=${date}`, { silentPaywall: true }) : null), [date, can('food_log')]);
  const [adding, setAdding] = useState(null);

  if (!can('food_log')) return <Locked feature="food_log" />;
  if (logs.loading && !logs.data) return <Loading />;
  if (logs.error) return <ErrorBox error={logs.error} />;
  const { meals, total } = logs.data;
  const remove = async (id) => { await api(`/food-logs/${id}`, { method: 'DELETE' }); logs.reload(); };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <h2 style={{ margin: 0 }}>Food diary</h2>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>
      <div className="card">
        <div className="grid grid-4">
          <Sum label="Calories" v={total.calories} max={user.calorie_target} unit="kcal" color="var(--brand)" />
          <Sum label="Protein" v={total.protein} max={user.protein_g} unit="g" color="var(--violet)" />
          <Sum label="Carbs" v={total.carbs} max={user.carbs_g} unit="g" color="var(--amber)" />
          <Sum label="Fat" v={total.fat} max={user.fat_g} unit="g" color="var(--blue)" />
        </div>
      </div>
      {MEALS.map(([key, label]) => {
        const items = meals[key];
        const kcal = items.reduce((s, i) => s + i.calories, 0);
        return (
          <div className="card" key={key}>
            <div className="meal-head">
              <div><h3 style={{ margin: 0 }}>{label}</h3><span className="muted small">{Math.round(kcal)} kcal</span></div>
              <button className="btn soft sm" onClick={() => setAdding(key)}>+ Add</button>
            </div>
            {items.length ? (
              <div className="list mt">
                {items.map((i) => (
                  <div className="list-item" key={i.id}>
                    <div><b>{i.food_name}</b><div className="muted small">{i.servings} serving · P {i.protein_g}g · C {i.carbs_g}g · F {i.fat_g}g</div></div>
                    <div className="row"><b>{Math.round(i.calories)}</b><button className="btn ghost sm" aria-label="Remove" onClick={() => remove(i.id)}>🗑</button></div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {adding ? <AddFood meal={adding} date={date} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); logs.reload(); }} /> : null}
    </div>
  );
}

const Sum = ({ label, v, max, unit, color }) => (
  <div className="stack" style={{ gap: 6 }}>
    <span className="muted small">{label}</span>
    <b style={{ fontSize: 20 }}>{Math.round(v)}<span className="muted small"> / {max || '—'} {unit}</span></b>
    <Bar value={v} max={max} color={color} />
  </div>
);

function AddFood({ meal, date, onClose, onAdded }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [servings, setServings] = useState(1);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => api(`/foods?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  const log = async () => {
    try {
      await api('/food-logs', { method: 'POST', body: { food_id: picked.id, meal, servings: Number(servings), date } });
      onAdded();
    } catch (e) { setError(e.message); }
  };

  if (custom) return <CustomFood onClose={onClose} onCreated={(f) => { setCustom(false); setPicked(f); }} />;

  return (
    <Modal title={`Add to ${meal}`} onClose={onClose}>
      {picked ? (
        <div className="stack">
          <div className="card">
            <b>{picked.name}</b> {picked.local_name ? <span className="muted">· {picked.local_name}</span> : null}
            <div className="muted small">{picked.serving_desc} = {picked.calories} kcal</div>
          </div>
          <label className="field">Servings
            <div className="row">
              {[0.5, 1, 1.5, 2, 3].map((s) => <button key={s} type="button" className={`chip ${Number(servings) === s ? 'active' : ''}`} onClick={() => setServings(s)}>{s}</button>)}
              <input type="number" step="0.25" min="0.25" value={servings} onChange={(e) => setServings(e.target.value)} style={{ width: 90 }} />
            </div>
          </label>
          <div className="grid grid-4 small">
            <div><span className="muted">Calories</span><br /><b>{Math.round(picked.calories * servings)}</b></div>
            <div><span className="muted">Protein</span><br /><b>{(picked.protein_g * servings).toFixed(1)}g</b></div>
            <div><span className="muted">Carbs</span><br /><b>{(picked.carbs_g * servings).toFixed(1)}g</b></div>
            <div><span className="muted">Fat</span><br /><b>{(picked.fat_g * servings).toFixed(1)}g</b></div>
          </div>
          {error ? <div className="error">{error}</div> : null}
          <div className="row"><button className="btn ghost" onClick={() => setPicked(null)}>Back</button><button className="btn block" onClick={log} disabled={!(servings > 0)}>Add to diary</button></div>
        </div>
      ) : (
        <div className="stack">
          <input placeholder="Search idli, dosa, chicken, apple…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="list" style={{ maxHeight: 380, overflow: 'auto' }}>
            {results.map((f) => (
              <button key={f.id} className="list-item" style={{ background: 'none', border: 0, borderBottom: '1px solid #f1f5f9', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setPicked(f)}>
                <div>
                  <b>{f.name}</b> <span style={{ color: f.is_veg ? 'var(--brand)' : 'var(--red)' }}>●</span>
                  <div className="muted small">{f.local_name ? `${f.local_name} · ` : ''}{f.serving_desc}</div>
                </div>
                <b>{Math.round(f.calories)} kcal</b>
              </button>
            ))}
            {!results.length ? <p className="muted">No foods found.</p> : null}
          </div>
          <button className="btn ghost" onClick={() => setCustom(true)}>+ Create custom food</button>
        </div>
      )}
    </Modal>
  );
}

function CustomFood({ onClose, onCreated }) {
  const [f, setF] = useState({ name: '', serving_desc: '1 serving', calories: '', protein_g: '', carbs_g: '', fat_g: '', is_veg: true });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...f, protein_g: f.protein_g || 0, carbs_g: f.carbs_g || 0, fat_g: f.fat_g || 0 };
      onCreated(await api('/foods', { method: 'POST', body }));
    } catch (err) { setError(err.message); }
  };
  return (
    <Modal title="Custom food" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <label className="field">Name<input value={f.name} onChange={set('name')} required /></label>
        <div className="grid grid-2">
          <label className="field">Serving<input value={f.serving_desc} onChange={set('serving_desc')} /></label>
          <label className="field">Calories<input type="number" value={f.calories} onChange={set('calories')} required /></label>
          <label className="field">Protein (g)<input type="number" step="0.1" value={f.protein_g} onChange={set('protein_g')} /></label>
          <label className="field">Carbs (g)<input type="number" step="0.1" value={f.carbs_g} onChange={set('carbs_g')} /></label>
          <label className="field">Fat (g)<input type="number" step="0.1" value={f.fat_g} onChange={set('fat_g')} /></label>
          <label className="row small"><input type="checkbox" checked={f.is_veg} onChange={set('is_veg')} /> Vegetarian</label>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn block">Save food</button>
      </form>
    </Modal>
  );
}
