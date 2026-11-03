import { useState } from 'react';
import { api, img, rupees } from '../api.js';
import { ErrorBox, Loading, Modal, useApi } from '../components/ui.jsx';

const CATS = ['strength', 'cardio', 'hiit', 'yoga', 'stretching'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DIETS = ['veg', 'non_veg', 'eggetarian', 'vegan'];
const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];

/** Field types: text, slug, number, textarea, select, bool, image, list (one item per line), money (₹ stored as paise), datetime */
export const CONTENT = {
  plans: {
    title: 'Subscription plans', label: 'name', idKey: 'id',
    help: 'Plans shown on the Premium page. Duration decides how many days are added when a user pays.',
    columns: [['name', 'Plan'], ['price_paise', 'Price', (v) => rupees(v)], ['duration_days', 'Days'], ['active', 'Active']],
    fields: [['name', 'Name', 'text'], ['code', 'Code (unique, e.g. monthly)', 'text'], ['interval', 'Interval', 'select', ['month', 'year', 'custom']],
      ['duration_days', 'Duration (days)', 'number'], ['price_paise', 'Price (₹)', 'money'], ['mrp_paise', 'Strike-through MRP (₹)', 'money'],
      ['description', 'Description', 'text'], ['highlights', 'Highlights (one per line)', 'list'], ['sort_order', 'Sort order', 'number'], ['active', 'Active', 'bool']],
    defaults: { interval: 'month', duration_days: 30, active: true, sort_order: 0, highlights: [] },
  },
  coupons: {
    title: 'Coupons', label: 'code', idKey: 'code',
    columns: [['code', 'Code'], ['percent_off', '% off'], ['amount_off_paise', '₹ off', (v) => (v ? rupees(v) : '—')], ['redeemed_count', 'Used'], ['max_redemptions', 'Limit'], ['active', 'Active']],
    fields: [['code', 'Code', 'text'], ['percent_off', 'Percent off', 'number'], ['amount_off_paise', 'Flat discount (₹)', 'money'], ['max_redemptions', 'Max redemptions', 'number'], ['expires_at', 'Expires at', 'datetime'], ['active', 'Active', 'bool']],
    defaults: { active: true },
  },
  workouts: {
    title: 'Workouts', label: 'title', idKey: 'id', image: true,
    help: 'Free workouts (Premium off) stay available to everyone after the trial ends.',
    columns: [['title', 'Title'], ['category', 'Category'], ['difficulty', 'Level'], ['duration_min', 'Min'], ['is_premium', 'Premium'], ['published', 'Published']],
    fields: [['title', 'Title', 'text'], ['slug', 'Slug (URL)', 'slug'], ['image_url', 'Cover image', 'image'], ['description', 'Description', 'textarea'],
      ['category', 'Category', 'select', CATS], ['difficulty', 'Difficulty', 'select', LEVELS], ['duration_min', 'Duration (min)', 'number'], ['calories_est', 'Calories (est.)', 'number'],
      ['is_premium', 'Premium only', 'bool'], ['published', 'Published', 'bool']],
    defaults: { category: 'strength', difficulty: 'beginner', duration_min: 15, calories_est: 100, is_premium: true, published: true },
  },
  exercises: {
    title: 'Exercises', label: 'name', idKey: 'id', image: true,
    help: 'Upload a photo or GIF for each exercise — it is shown in the workout player.',
    columns: [['name', 'Name'], ['category', 'Category'], ['muscle_group', 'Muscles'], ['met', 'MET']],
    fields: [['name', 'Name', 'text'], ['slug', 'Slug', 'slug'], ['image_url', 'Image / GIF', 'image'], ['category', 'Category', 'select', CATS], ['muscle_group', 'Muscle group', 'text'],
      ['equipment', 'Equipment', 'text'], ['difficulty', 'Difficulty', 'select', LEVELS], ['met', 'MET (intensity, for calorie burn)', 'number'], ['instructions', 'Instructions (one step per line)', 'textarea']],
    defaults: { category: 'strength', difficulty: 'beginner', equipment: 'none', met: 4 },
  },
  foods: {
    title: 'Food database', label: 'name', idKey: 'id',
    columns: [['name', 'Food'], ['local_name', 'Local name'], ['serving_desc', 'Serving'], ['calories', 'kcal'], ['protein_g', 'P'], ['carbs_g', 'C'], ['fat_g', 'F']],
    fields: [['name', 'Name', 'text'], ['local_name', 'Local name (Tamil/Hindi…)', 'text'], ['category', 'Category', 'text'], ['serving_desc', 'Serving description', 'text'], ['serving_g', 'Serving (g)', 'number'],
      ['calories', 'Calories', 'number'], ['protein_g', 'Protein (g)', 'number'], ['carbs_g', 'Carbs (g)', 'number'], ['fat_g', 'Fat (g)', 'number'], ['fiber_g', 'Fibre (g)', 'number'], ['is_veg', 'Vegetarian', 'bool'], ['verified', 'Verified', 'bool']],
    defaults: { serving_desc: '1 serving', is_veg: true, verified: true, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  },
  recipes: {
    title: 'Recipes', label: 'title', idKey: 'id', image: true,
    columns: [['title', 'Title'], ['meal_type', 'Meal'], ['diet_type', 'Diet'], ['calories', 'kcal'], ['published', 'Published']],
    fields: [['title', 'Title', 'text'], ['image_url', 'Image', 'image'], ['description', 'Description', 'textarea'], ['meal_type', 'Meal', 'select', MEALS], ['diet_type', 'Diet', 'select', DIETS],
      ['calories', 'Calories', 'number'], ['protein_g', 'Protein (g)', 'number'], ['carbs_g', 'Carbs (g)', 'number'], ['fat_g', 'Fat (g)', 'number'], ['prep_min', 'Prep time (min)', 'number'],
      ['ingredients', 'Ingredients (one per line)', 'list'], ['steps', 'Steps (one per line)', 'list'], ['published', 'Published', 'bool']],
    defaults: { meal_type: 'lunch', diet_type: 'veg', published: true, ingredients: [], steps: [], prep_min: 15 },
  },
  articles: {
    title: 'Articles', label: 'title', idKey: 'id', image: true,
    columns: [['title', 'Title'], ['category', 'Category'], ['published', 'Published']],
    fields: [['title', 'Title', 'text'], ['image_url', 'Cover image', 'image'], ['category', 'Category', 'text'], ['summary', 'Summary', 'textarea'], ['body', 'Body', 'textarea'], ['published', 'Published', 'bool']],
    defaults: { category: 'wellness', published: true },
  },
};

const show = (v) => (typeof v === 'boolean' ? (v ? '✅' : '—') : v ?? '—');

export function ContentAdmin({ kind }) {
  const cfg = CONTENT[kind];
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [exEditor, setExEditor] = useState(null);
  const list = useApi(() => api(`/admin/${kind}?q=${encodeURIComponent(q)}`), [kind, q]);

  const remove = async (row) => {
    if (!confirm(`Delete "${row[cfg.label]}"?`)) return;
    await api(`/admin/${kind}/${row[cfg.idKey]}`, { method: 'DELETE' });
    list.reload();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap">
        <h1 style={{ margin: 0 }}>{cfg.title}</h1>
        <div className="row"><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} /><button className="btn" onClick={() => setEditing({ ...cfg.defaults })}>+ Add</button></div>
      </div>
      {cfg.help ? <p className="muted" style={{ margin: 0 }}>{cfg.help}</p> : null}
      <ErrorBox error={list.error} />
      <div className="card table-wrap">
        {list.loading && !list.data ? <Loading /> : null}
        <table>
          <thead><tr>{cfg.image ? <th /> : null}{cfg.columns.map(([k, l]) => <th key={k}>{l}</th>)}<th /></tr></thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row[cfg.idKey]}>
                {cfg.image ? <td>{row.image_url ? <img className="thumb" src={img(row.image_url)} alt="" /> : <div className="thumb" />}</td> : null}
                {cfg.columns.map(([k, , fmt]) => <td key={k}>{fmt ? fmt(row[k]) : show(row[k])}</td>)}
                <td style={{ whiteSpace: 'nowrap' }}>
                  {kind === 'workouts' ? <button className="btn soft sm" onClick={() => setExEditor(row)}>Exercises</button> : null}{' '}
                  <button className="btn ghost sm" onClick={() => setEditing(row)}>Edit</button>{' '}
                  <button className="btn danger sm" onClick={() => remove(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && !list.data.length ? <p className="muted">Nothing here yet.</p> : null}
      </div>
      {editing ? <Editor kind={kind} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} /> : null}
      {exEditor ? <WorkoutExercises workout={exEditor} onClose={() => setExEditor(null)} /> : null}
    </div>
  );
}

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function Editor({ kind, row, onClose, onSaved }) {
  const cfg = CONTENT[kind];
  const isNew = row[cfg.idKey] == null;
  const [f, setF] = useState(() => {
    const out = {};
    for (const [k, , type] of cfg.fields) {
      const v = row[k];
      out[k] = type === 'money' ? (v != null ? v / 100 : '') : type === 'list' ? (v || []).join('\n') : type === 'datetime' ? (v ? String(v).slice(0, 16) : '') : v ?? (type === 'bool' ? false : '');
    }
    return out;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v, ...(isNew && cfg.fields.some(([x, , t]) => x === 'slug' && t === 'slug') && k === cfg.label ? { slug: slugify(v) } : {}) }));

  const upload = async (k, file) => {
    const form = new FormData();
    form.append('image', file);
    try { const r = await api('/admin/upload', { method: 'POST', form }); set(k, r.url); } catch (e) { setError(e.message); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const body = {};
    for (const [k, , type] of cfg.fields) {
      const v = f[k];
      if (type === 'money') body[k] = v === '' ? null : Math.round(Number(v) * 100);
      else if (type === 'list') body[k] = String(v).split('\n').map((s) => s.trim()).filter(Boolean);
      else if (type === 'number') body[k] = v === '' ? null : Number(v);
      else if (type === 'datetime') body[k] = v ? new Date(v).toISOString() : null;
      else if (type === 'bool') body[k] = !!v;
      else body[k] = v === '' ? null : v;
    }
    for (const k of Object.keys(body)) if (body[k] === null && isNew) delete body[k];
    try {
      await api(isNew ? `/admin/${kind}` : `/admin/${kind}/${row[cfg.idKey]}`, { method: isNew ? 'POST' : 'PUT', body });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`${isNew ? 'Add' : 'Edit'} ${cfg.title.toLowerCase().replace(/s$/, '')}`} onClose={onClose} wide>
      <form className="stack" onSubmit={save}>
        <div className="grid grid-2">
          {cfg.fields.map(([k, label, type, options]) => {
            const wide = ['textarea', 'list', 'image'].includes(type);
            return (
              <label key={k} className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
                {type === 'bool' ? <span className="row"><input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</span> : label}
                {type === 'text' || type === 'slug' ? <input value={f[k]} onChange={(e) => set(k, e.target.value)} disabled={!isNew && k === cfg.idKey} /> : null}
                {type === 'number' ? <input type="number" step="any" value={f[k]} onChange={(e) => set(k, e.target.value)} /> : null}
                {type === 'money' ? <input type="number" step="0.01" value={f[k]} onChange={(e) => set(k, e.target.value)} /> : null}
                {type === 'datetime' ? <input type="datetime-local" value={f[k]} onChange={(e) => set(k, e.target.value)} /> : null}
                {type === 'textarea' ? <textarea value={f[k]} onChange={(e) => set(k, e.target.value)} rows={k === 'body' ? 10 : 4} /> : null}
                {type === 'list' ? <textarea value={f[k]} onChange={(e) => set(k, e.target.value)} rows={5} /> : null}
                {type === 'select' ? <select value={f[k]} onChange={(e) => set(k, e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select> : null}
                {type === 'image' ? (
                  <div className="row wrap">
                    {f[k] ? <img src={img(f[k])} alt="" style={{ width: 160, borderRadius: 10 }} /> : null}
                    <div className="stack" style={{ flex: 1, minWidth: 220 }}>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files[0] && upload(k, e.target.files[0])} />
                      <input placeholder="…or paste an image URL" value={f[k]} onChange={(e) => set(k, e.target.value)} />
                    </div>
                  </div>
                ) : null}
              </label>
            );
          })}
        </div>
        {error ? <div className="error">{error}</div> : null}
        <div className="row"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function WorkoutExercises({ workout, onClose }) {
  const all = useApi(() => api('/admin/exercises'), []);
  const current = useApi(() => api(`/admin/workouts/${workout.id}/exercises`), [workout.id]);
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState(null);
  const rows = items ?? current.data;
  const byId = Object.fromEntries((all.data || []).map((e) => [e.id, e]));

  const update = (i, k, v) => setItems(rows.map((r, j) => (j === i ? { ...r, [k]: v === '' ? null : Number(v) } : r)));
  const move = (i, d) => { const n = [...rows]; [n[i], n[i + d]] = [n[i + d], n[i]]; setItems(n); };
  const save = async () => {
    try {
      await api(`/admin/workouts/${workout.id}/exercises`, { method: 'PUT', body: rows.map(({ exercise_id, sets, reps, duration_sec, rest_sec }) => ({ exercise_id, sets, reps, duration_sec, rest_sec })) });
      setMsg({ ok: 'Saved' });
    } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <Modal title={`Exercises · ${workout.title}`} onClose={onClose} wide>
      {!rows || !all.data ? <Loading /> : (
        <div className="stack">
          <p className="muted small" style={{ margin: 0 }}>Set either reps (e.g. 12 squats) or duration in seconds (e.g. 30s plank) for each exercise.</p>
          <div className="table-wrap"><table>
            <thead><tr><th /><th>Exercise</th><th>Sets</th><th>Reps</th><th>Seconds</th><th>Rest (s)</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td>{byId[r.exercise_id]?.image_url ? <img className="thumb" src={img(byId[r.exercise_id].image_url)} alt="" /> : null}</td>
                <td><select value={r.exercise_id} onChange={(e) => update(i, 'exercise_id', e.target.value)}>{all.data.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></td>
                <td><input type="number" min="1" value={r.sets ?? ''} onChange={(e) => update(i, 'sets', e.target.value)} style={{ width: 64 }} /></td>
                <td><input type="number" min="1" value={r.reps ?? ''} onChange={(e) => update(i, 'reps', e.target.value)} style={{ width: 70 }} /></td>
                <td><input type="number" min="5" value={r.duration_sec ?? ''} onChange={(e) => update(i, 'duration_sec', e.target.value)} style={{ width: 80 }} /></td>
                <td><input type="number" min="0" value={r.rest_sec ?? ''} onChange={(e) => update(i, 'rest_sec', e.target.value)} style={{ width: 70 }} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn ghost sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn danger sm" onClick={() => setItems(rows.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
          <button className="btn ghost" onClick={() => setItems([...rows, { exercise_id: all.data[0].id, sets: 3, reps: 10, duration_sec: null, rest_sec: 20 }])}>+ Add exercise</button>
          {msg?.ok ? <div className="success">{msg.ok}</div> : null}
          {msg?.err ? <div className="error">{msg.err}</div> : null}
          <button className="btn" onClick={save}>Save exercises</button>
        </div>
      )}
    </Modal>
  );
}
