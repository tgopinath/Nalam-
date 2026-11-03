import { useState } from 'react';
import { api } from '../api.js';
import { Loading, useApi } from '../components/ui.jsx';

export default function Broadcast() {
  const list = useApi(() => api('/admin/notifications'), []);
  const [f, setF] = useState({ title: '', body: '' });
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    if (!confirm('Send this notification to ALL users?')) return;
    try { await api('/admin/notifications', { method: 'POST', body: f }); setF({ title: '', body: '' }); setMsg('Sent to all users'); list.reload(); } catch (err) { setMsg(err.message); }
  };
  const del = async (id) => { await api(`/admin/notifications/${id}`, { method: 'DELETE' }); list.reload(); };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>Notifications</h1>
      <form className="card stack" onSubmit={send}>
        <h3>Broadcast to all users</h3>
        <input placeholder="Title, e.g. New yoga workouts are live! 🧘" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <textarea placeholder="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required />
        {msg ? <div className="success">{msg}</div> : null}
        <button className="btn" style={{ alignSelf: 'flex-start' }}>Send to everyone</button>
      </form>
      <div className="card">
        <h3>Sent broadcasts</h3>
        {list.loading ? <Loading /> : null}
        <div className="list">{list.data?.map((n) => (
          <div className="list-item" key={n.id}><div><b>{n.title}</b><div className="muted small">{n.body}</div></div>
            <div className="row"><span className="muted small">{new Date(n.created_at).toLocaleDateString('en-IN')}</span><button className="btn ghost sm" onClick={() => del(n.id)}>Delete</button></div></div>
        ))}</div>
      </div>
    </div>
  );
}
