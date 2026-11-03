import { api } from '../api.js';
import { Empty, Loading, useApi } from '../components/ui.jsx';

export default function Notifications() {
  const n = useApi(() => api('/me/notifications'), []);
  if (n.loading) return <Loading />;
  return (
    <div className="card">
      <h2>Notifications</h2>
      {!n.data?.length ? <Empty>You're all caught up 🎉</Empty> : null}
      <div className="list">
        {n.data?.map((x) => (
          <div className="list-item" key={x.id} style={{ alignItems: 'flex-start' }}>
            <div><b>{x.title}</b><div className="muted small">{x.body}</div></div>
            <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{new Date(x.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
