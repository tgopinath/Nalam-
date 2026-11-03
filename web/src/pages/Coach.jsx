import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Locked } from '../components/Paywall.jsx';
import { ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function Coach() {
  const { can } = useAuth();
  const msgs = useApi(() => (can('coach') ? api('/coach/messages') : null), []);
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.data]);
  useEffect(() => {
    if (!can('coach')) return;
    const t = setInterval(() => api('/coach/messages').then(msgs.setData).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('coach')) return <Locked feature="coach" />;
  if (msgs.loading && !msgs.data) return <Loading />;
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api('/coach/messages', { method: 'POST', body: { body: text } });
    setText('');
    msgs.reload();
  };
  return (
    <div className="card stack">
      <div className="row"><div className="tile"><div className="ico" style={{ background: 'var(--brand-100)' }}>🧑‍⚕️</div></div><div><h3 style={{ margin: 0 }}>Your Nalam coach</h3><span className="muted small">Nutritionists & trainers · usually reply within 24h</span></div></div>
      <ErrorBox error={msgs.error} />
      <div className="chat">
        {!msgs.data?.length ? <p className="muted" style={{ textAlign: 'center' }}>Ask anything about diet, workouts or your goals 👋</p> : null}
        {msgs.data?.map((m) => (
          <div key={m.id} className={`bubble ${m.sender === 'user' ? 'me' : 'them'}`}>{m.body}<time>{new Date(m.created_at).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</time></div>
        ))}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={send}>
        <input placeholder="Type your message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <button className="btn" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
