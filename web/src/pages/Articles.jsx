import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, img } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Locked } from '../components/Paywall.jsx';
import { Empty, ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function Articles() {
  const { id } = useParams();
  const { can } = useAuth();
  if (!can('articles')) return <Locked feature="articles" />;
  return id ? <Article id={id} /> : <List />;
}

function List() {
  const list = useApi(() => api('/articles'), []);
  if (list.loading) return <Loading />;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h2 style={{ margin: 0 }}>Learn</h2>
      <ErrorBox error={list.error} />
      <div className="cards">
        {list.data?.map((a) => (
          <Link key={a.id} to={`/articles/${a.id}`} className="media-card">
            <img src={img(a.image_url)} alt={a.title} loading="lazy" />
            <div className="body"><span className="badge blue" style={{ alignSelf: 'flex-start' }}>{a.category}</span><b>{a.title}</b><span className="muted small">{a.summary}</span></div>
          </Link>
        ))}
      </div>
      {list.data && !list.data.length ? <Empty>No articles yet.</Empty> : null}
    </div>
  );
}

function Article({ id }) {
  const a = useApi(() => api(`/articles/${id}`), [id]);
  if (a.loading) return <Loading />;
  if (a.error) return <ErrorBox error={a.error} />;
  return (
    <article className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <Link to="/articles" className="small">← All articles</Link>
      <img className="hero-img" src={img(a.data.image_url)} alt="" />
      <span className="badge blue" style={{ alignSelf: 'flex-start' }}>{a.data.category}</span>
      <h1>{a.data.title}</h1>
      <span className="muted small">{fmtDate(a.data.created_at)}</span>
      <div className="prose">{a.data.body}</div>
    </article>
  );
}
