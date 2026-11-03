import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Profile() {
  const { user, access, setUser, signOut, config } = useAuth();
  const [f, setF] = useState({
    name: user.name || '', height_cm: user.height_cm || '', target_weight_kg: user.target_weight_kg || '', activity_level: user.activity_level || 'light',
    goal: user.goal || 'maintain', diet_pref: user.diet_pref || 'veg', calorie_target: user.calorie_target || '', water_target_ml: user.water_target_ml || 2500, step_target: user.step_target || 8000,
  });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const r = await api('/me/profile', { method: 'PATCH', body });
      setUser(r.user);
      setF((s) => ({ ...s, calorie_target: r.user.calorie_target, water_target_ml: r.user.water_target_ml }));
      setMsg({ ok: 'Profile saved' });
    } catch (err) { setMsg({ err: err.message }); }
  };

  const del = async () => {
    if (!confirm('Delete your Nalam account and all your data permanently?')) return;
    await api('/me', { method: 'DELETE' });
    signOut();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row between wrap">
        <div className="row">
          {user.avatar_url ? <img src={user.avatar_url} alt="" width="56" height="56" style={{ borderRadius: '50%' }} /> : <div className="tile"><div className="ico" style={{ background: 'var(--brand-100)', width: 56, height: 56, fontSize: 26 }}>👤</div></div>}
          <div>
            <h2 style={{ margin: 0 }}>{user.name || 'Nalam user'}</h2>
            <div className="muted small">{[user.email, user.phone].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
          <span className={`badge ${access.status === 'premium' ? 'green' : access.status === 'trial' ? 'orange' : 'red'}`}>
            {access.status === 'premium' ? `Premium until ${fmtDate(access.premiumUntil)}` : access.status === 'trial' ? `Free trial · ${access.daysLeft} days left` : access.status === 'admin' ? 'Admin' : 'Trial ended'}
          </span>
          <Link to="/premium" className="small">Manage subscription →</Link>
        </div>
      </div>

      <form className="card stack" onSubmit={save}>
        <h3>Goals & body</h3>
        <div className="grid grid-3">
          <label className="field">Name<input value={f.name} onChange={set('name')} /></label>
          <label className="field">Height (cm)<input type="number" value={f.height_cm} onChange={set('height_cm')} /></label>
          <label className="field">Target weight (kg)<input type="number" step="0.1" value={f.target_weight_kg} onChange={set('target_weight_kg')} /></label>
          <label className="field">Goal<select value={f.goal} onChange={set('goal')}><option value="lose">Lose weight</option><option value="maintain">Maintain</option><option value="gain">Gain muscle</option></select></label>
          <label className="field">Activity<select value={f.activity_level} onChange={set('activity_level')}>
            <option value="sedentary">Sedentary</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="active">Very active</option><option value="very_active">Athlete</option>
          </select></label>
          <label className="field">Diet<select value={f.diet_pref} onChange={set('diet_pref')}><option value="veg">Vegetarian</option><option value="non_veg">Non-veg</option><option value="eggetarian">Eggetarian</option><option value="vegan">Vegan</option></select></label>
          <label className="field">Daily calories<input type="number" value={f.calorie_target} onChange={set('calorie_target')} /></label>
          <label className="field">Water goal (ml)<input type="number" step="250" value={f.water_target_ml} onChange={set('water_target_ml')} /></label>
          <label className="field">Step goal<input type="number" step="500" value={f.step_target} onChange={set('step_target')} /></label>
        </div>
        {msg?.ok ? <div className="success">{msg.ok}</div> : null}
        {msg?.err ? <div className="error">{msg.err}</div> : null}
        <button className="btn" style={{ alignSelf: 'flex-start' }}>Save changes</button>
      </form>

      <LinkPhone />
      <ChangePassword hasPassword={user.has_password} hasEmail={!!user.email} />

      <div className="card stack">
        <h3>Account</h3>
        <span className="muted small">Need help? Write to {config?.supportEmail}</span>
        <div className="row wrap">
          <button className="btn ghost" onClick={signOut}>Log out</button>
          <button className="btn ghost" onClick={async () => { await api('/auth/logout-all', { method: 'POST' }); signOut(); }}>Log out of all devices</button>
          <button className="btn danger" onClick={del}>Delete account</button>
        </div>
      </div>
    </div>
  );
}

function LinkPhone() {
  const { user, setSession } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState(null);
  if (user.phone) return null;
  const go = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/phone/link', { method: 'POST', body: { phone, code: sent ? code : undefined } });
      if (!sent) { setSent(true); setMsg({ ok: 'OTP sent to your phone' }); } else { setSession(r); setMsg({ ok: 'Phone linked' }); }
    } catch (err) { setMsg({ err: err.message }); }
  };
  return (
    <form className="card stack" onSubmit={go}>
      <h3>Add mobile number</h3>
      <span className="muted small">Log in with OTP on any device.</span>
      <div className="row">
        <input placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} required />
        {sent ? <input placeholder="OTP" className="otp-input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /> : null}
        <button className="btn">{sent ? 'Verify' : 'Send OTP'}</button>
      </div>
      {msg?.ok ? <div className="success">{msg.ok}</div> : null}
      {msg?.err ? <div className="error">{msg.err}</div> : null}
    </form>
  );
}

function ChangePassword({ hasPassword, hasEmail }) {
  const [f, setF] = useState({ current: '', password: '' });
  const [msg, setMsg] = useState(null);
  if (!hasEmail) return null;
  const go = async (e) => {
    e.preventDefault();
    try { await api('/me/password', { method: 'POST', body: f }); setMsg({ ok: 'Password updated' }); setF({ current: '', password: '' }); } catch (err) { setMsg({ err: err.message }); }
  };
  return (
    <form className="card stack" onSubmit={go}>
      <h3>{hasPassword ? 'Change password' : 'Set a password'}</h3>
      <div className="row wrap">
        {hasPassword ? <input type="password" placeholder="Current password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} style={{ maxWidth: 240 }} /> : null}
        <input type="password" placeholder="New password (8+ chars)" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} style={{ maxWidth: 240 }} required />
        <button className="btn ghost">Update</button>
      </div>
      {msg?.ok ? <div className="success">{msg.ok}</div> : null}
      {msg?.err ? <div className="error">{msg.err}</div> : null}
    </form>
  );
}
