import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Empty, Loading, useApi } from '../components/ui.jsx';

export default function CoachInbox() {
  const threads = useApi(() => api('/admin/coach/threads'), []);
  const [sel, setSel] = useState(null);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>Coach inbox</h1>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 320px) 1fr' }}>
        <div className="card" style={{ padding: 8, maxHeight: '75vh', overflow: 'auto' }}>
          {threads.loading ? <Loading /> : null}
          {threads.data && !threads.data.length ? <Empty>No conversations yet.</Empty> : null}
          {threads.data?.map((t) => (
            <button key={t.user_id} onClick={() => setSel(t.user_id)} className="list-item" style={{ width: '100%', border: 0, background: sel === t.user_id ? 'var(--brand-50)' : 'none', borderRadius: 10, padding: 10, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ minWidth: 0 }}>
                <b>{t.name || t.email || t.phone}</b>
                <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{t.last_sender === 'coach' ? 'You: ' : ''}{t.last_body}</div>
              </div>
              {t.unanswered ? <span className="badge red">{t.unanswered}</span> : null}
            </button>
          ))}
        </div>
        {sel ? <Thread id={sel} onSent={threads.reload} /> : <div className="card"><Empty>Select a conversation</Empty></div>}
      </div>
    </div>
  );
}

function Thread({ id, onSent }) {
  const t = useApi(() => api(`/admin/coach/threads/${id}`), [id]);
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView(); }, [t.data]);
  if (t.loading && !t.data) return <div className="card"><Loading /></div>;
  const u = t.data.user;
  const send = async (e) => {
    e.preventDefault();
    await api(`/admin/coach/threads/${id}`, { method: 'POST', body: { body: text } });
    setText(''); t.reload(); onSent();
  };
  return (
    <div className="card stack">
      <div><b>{u.name}</b> <span className="muted small">{u.email} {u.phone} · goal: {u.goal || '—'} · {u.weight_kg ?? '—'}kg → {u.target_weight_kg ?? '—'}kg · {u.diet_pref || ''}</span></div>
      <div className="chat" style={{ height: '55vh' }}>
        {t.data.messages.map((m) => <div key={m.id} className={`bubble ${m.sender === 'coach' ? 'me' : 'them'}`}>{m.body}<time>{new Date(m.created_at).toLocaleString('en-IN')}</time></div>)}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply as coach…" /><button className="btn" disabled={!text.trim()}>Send</button></form>
    </div>
  );
}
