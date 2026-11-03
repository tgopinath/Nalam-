import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox, Loading, useApi } from '../components/ui.jsx';

export default function Settings() {
  const { refresh } = useAuth();
  const s = useApi(() => api('/admin/settings'), []);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (s.data) setF(s.data.settings); }, [s.data]);
  if (s.loading || !f) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} />;
  const features = s.data.features;

  const toggleFree = (k) => setF({ ...f, free_features: f.free_features.includes(k) ? f.free_features.filter((x) => x !== k) : [...f.free_features, k] });
  const save = async () => {
    try {
      await api('/admin/settings', { method: 'PUT', body: { ...f, trial_days: Number(f.trial_days) } });
      setMsg({ ok: 'Settings saved. Changes apply to all users within a few seconds.' });
      refresh();
    } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>App settings</h1>
      <div className="card stack">
        <h3>Free trial</h3>
        <label className="field" style={{ maxWidth: 260 }}>Trial length for new sign-ups (days)
          <input type="number" min="0" max="365" value={f.trial_days} onChange={(e) => setF({ ...f, trial_days: e.target.value })} />
        </label>
        <span className="muted small">Every feature is unlocked during the trial. Existing users keep their current trial end date (edit it per-user in Users).</span>
      </div>

      <div className="card stack">
        <h3>Features available after the trial (without a subscription)</h3>
        <div className="grid grid-2">
          {Object.entries(features).map(([k, label]) => (
            <label key={k} className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={f.free_features.includes(k)} onChange={() => toggleFree(k)} /> {label}
              {f.free_features.includes(k) ? <span className="badge green">Free</span> : <span className="badge orange">Premium</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3>Login methods</h3>
        <div className="row wrap" style={{ gap: 24 }}>
          {[['phone', '📱 Mobile OTP'], ['email', '✉️ Email'], ['google', 'G Google']].map(([k, l]) => (
            <label key={k} className="row"><input type="checkbox" checked={!!f.auth_methods[k]} onChange={(e) => setF({ ...f, auth_methods: { ...f.auth_methods, [k]: e.target.checked } })} /> {l}</label>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3>Communication</h3>
        <label className="field">Announcement banner (shown at the top of the app — leave empty to hide)<input value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} /></label>
        <label className="field">Support email<input value={f.support_email} onChange={(e) => setF({ ...f, support_email: e.target.value })} /></label>
        <label className="field">Coach auto-reply (sent after a user's first message)<textarea value={f.coach_auto_reply} onChange={(e) => setF({ ...f, coach_auto_reply: e.target.value })} /></label>
      </div>

      <div className="card stack">
        <h3>Maintenance</h3>
        <label className="row"><input type="checkbox" checked={f.maintenance_mode} onChange={(e) => setF({ ...f, maintenance_mode: e.target.checked })} /> Maintenance mode — users see a "be right back" screen; admins still have access</label>
      </div>

      {msg?.ok ? <div className="success">{msg.ok}</div> : null}
      {msg?.err ? <div className="error">{msg.err}</div> : null}
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={save}>Save settings</button>
    </div>
  );
}
