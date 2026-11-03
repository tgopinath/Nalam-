import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, img } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Locked } from '../components/Paywall.jsx';
import { Empty, ErrorBox, Loading, useApi } from '../components/ui.jsx';

const DIET = { veg: '🥦 Veg', non_veg: '🍗 Non-veg', eggetarian: '🥚 Egg', vegan: '🌱 Vegan' };

export default function Recipes() {
  const { id } = useParams();
  const { can } = useAuth();
  if (!can('recipes')) return <Locked feature="recipes" />;
  return id ? <Recipe id={id} /> : <RecipeList />;
}

function RecipeList() {
  const [meal, setMeal] = useState('');
  const [diet, setDiet] = useState('');
  const list = useApi(() => api(`/recipes?meal=${meal}&diet=${diet}`), [meal, diet]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h2 style={{ margin: 0 }}>Healthy recipes</h2>
      <div className="chips">
        {['', 'breakfast', 'lunch', 'snacks', 'dinner'].map((m) => <button key={m} className={`chip ${meal === m ? 'active' : ''}`} onClick={() => setMeal(m)}>{m || 'All meals'}</button>)}
      </div>
      <div className="chips">
        {['', ...Object.keys(DIET)].map((d) => <button key={d} className={`chip ${diet === d ? 'active' : ''}`} onClick={() => setDiet(d)}>{d ? DIET[d] : 'Any diet'}</button>)}
      </div>
      {list.loading && !list.data ? <Loading /> : null}
      <ErrorBox error={list.error} />
      <div className="cards">
        {list.data?.map((r) => (
          <Link key={r.id} to={`/recipes/${r.id}`} className="media-card">
            <img src={img(r.image_url)} alt={r.title} loading="lazy" />
            <div className="body">
              <b>{r.title}</b>
              <div className="row wrap" style={{ gap: 6 }}><span className="badge green">{r.calories} kcal</span><span className="badge">⏱ {r.prep_min} min</span><span className="badge">{DIET[r.diet_type]}</span></div>
            </div>
          </Link>
        ))}
      </div>
      {list.data && !list.data.length ? <Empty>No recipes found.</Empty> : null}
    </div>
  );
}

function Recipe({ id }) {
  const r = useApi(() => api(`/recipes/${id}`), [id]);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const d = r.data;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Link to="/recipes" className="small">← All recipes</Link>
      <img className="hero-img" src={img(d.image_url)} alt={d.title} />
      <h1>{d.title}</h1>
      <p className="muted" style={{ margin: 0 }}>{d.description}</p>
      <div className="grid grid-4">
        {[['Calories', `${d.calories}`], ['Protein', `${d.protein_g} g`], ['Carbs', `${d.carbs_g} g`], ['Fat', `${d.fat_g} g`]].map(([l, v]) => (
          <div className="card" key={l}><span className="muted small">{l}</span><br /><b style={{ fontSize: 20 }}>{v}</b></div>
        ))}
      </div>
      <div className="grid grid-2">
        <div className="card"><h3>Ingredients</h3><ul className="check-list">{d.ingredients.map((i) => <li key={i}>{i}</li>)}</ul></div>
        <div className="card"><h3>Method</h3><ol style={{ lineHeight: 1.8, paddingLeft: 20 }}>{d.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
      </div>
    </div>
  );
}
