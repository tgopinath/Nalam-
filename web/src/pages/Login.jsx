import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { config, signIn } = useAuth();
  const methods = config?.authMethods || { phone: true, email: true, google: true };
  const [tab, setTab] = useState('phone');
  useEffect(() => { if (!methods.phone && methods.email) setTab('email'); }, [methods.phone, methods.email]);

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="row"><img src="/favicon.svg" width="48" alt="" /><b style={{ fontSize: 24 }}>Nalam</b></div>
        <h1>Your health,<br />simplified.</h1>
        <p style={{ fontSize: 17, opacity: 0.95, margin: 0 }}>Track food, workouts, water, weight and sleep in one place — with Indian foods, guided workouts and real coaches.</p>
        <ul>
          <li>🍛 Calorie tracking with 60+ South & North Indian foods</li>
          <li>💪 Guided workouts & yoga with step-by-step images</li>
          <li>💧 Water, steps, sleep and weight trackers</li>
          <li>💬 Chat with a Nalam coach</li>
        </ul>
        <div className="badge" style={{ alignSelf: 'flex-start', background: '#fff', color: '#15803d', fontSize: 14, padding: '8px 14px' }}>
          🎁 All Premium features free for {config?.trialDays ?? 7} days
        </div>
      </section>
      <section className="auth-panel">
        <div className="card narrow stack">
          <h2>Welcome 👋</h2>
          <p className="muted" style={{ margin: 0 }}>Log in or create your account</p>
          {methods.phone && methods.email ? (
            <div className="tabs">
              <button className={tab === 'phone' ? 'active' : ''} onClick={() => setTab('phone')}>📱 Mobile</button>
              <button className={tab === 'email' ? 'active' : ''} onClick={() => setTab('email')}>✉️ Email</button>
            </div>
          ) : null}
          {tab === 'phone' && methods.phone ? <OtpForm channel="phone" onDone={signIn} /> : null}
          {tab === 'email' && methods.email ? <EmailForm onDone={signIn} /> : null}
          {methods.google && config?.googleClientIds?.length ? (
            <>
              <div className="divider">or</div>
              <GoogleButton clientId={config.googleClientIds[0]} onDone={signIn} />
            </>
          ) : null}
          <p className="small muted" style={{ margin: 0 }}>By continuing you agree to Nalam's Terms and Privacy Policy.</p>
        </div>
      </section>
    </div>
  );
}

function OtpForm({ channel, onDone, initialTarget = '' }) {
  const [target, setTarget] = useState(initialTarget);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/auth/otp/request', { method: 'POST', body: { channel, target } });
      setSent(true); setCooldown(30);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      onDone(await api('/auth/otp/verify', { method: 'POST', body: { channel, target, code, name: name || undefined } }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (!sent) {
    return (
      <form className="stack" onSubmit={send}>
        <label className="field">{channel === 'phone' ? 'Mobile number' : 'Email'}
          {channel === 'phone' ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="badge" style={{ padding: '12px 12px', borderRadius: 12 }}>🇮🇳 +91</span>
              <input inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={target} onChange={(e) => setTarget(e.target.value)} required />
            </div>
          ) : <input type="email" autoComplete="email" value={target} onChange={(e) => setTarget(e.target.value)} required />}
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn block" disabled={busy || !target}>{busy ? 'Sending…' : 'Get OTP'}</button>
      </form>
    );
  }
  return (
    <form className="stack" onSubmit={verify}>
      <div className="success">We sent a 6-digit code to <b>{target}</b>. <a href="#" onClick={(e) => { e.preventDefault(); setSent(false); setCode(''); }}>Change</a></div>
      <label className="field">Enter OTP
        <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
      </label>
      <label className="field">Your name <span className="muted small" style={{ fontWeight: 400 }}>(new users)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <button className="btn block" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
      <button type="button" className="btn ghost block" disabled={cooldown > 0 || busy} onClick={send}>{cooldown ? `Resend in ${cooldown}s` : 'Resend OTP'}</button>
    </form>
  );
}

function EmailForm({ onDone }) {
  const [mode, setMode] = useState('login'); // login | register | otp | forgot | reset
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'login') onDone(await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } }));
      if (mode === 'register') onDone(await api('/auth/register', { method: 'POST', body: { name: f.name, email: f.email, password: f.password } }));
      if (mode === 'forgot') { await api('/auth/password/forgot', { method: 'POST', body: { email: f.email } }); setMode('reset'); }
      if (mode === 'reset') onDone(await api('/auth/password/reset', { method: 'POST', body: { email: f.email, code: f.code, password: f.password } }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (mode === 'otp') {
    return <div className="stack"><OtpForm channel="email" onDone={onDone} initialTarget={f.email} /><button className="btn ghost sm" onClick={() => setMode('login')}>Use password instead</button></div>;
  }
  return (
    <form className="stack" onSubmit={submit}>
      {mode === 'register' ? <label className="field">Full name<input value={f.name} onChange={set('name')} required autoComplete="name" /></label> : null}
      <label className="field">Email<input type="email" value={f.email} onChange={set('email')} required autoComplete="email" disabled={mode === 'reset'} /></label>
      {mode === 'reset' ? <label className="field">Reset code (sent to your email)<input className="otp-input" inputMode="numeric" maxLength={6} value={f.code} onChange={set('code')} required /></label> : null}
      {mode !== 'forgot' ? (
        <label className="field">{mode === 'reset' ? 'New password' : 'Password'}
          <input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'login' ? 1 : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      <button className="btn block" disabled={busy}>
        {busy ? 'Please wait…' : { login: 'Log in', register: 'Create account', forgot: 'Send reset code', reset: 'Reset password' }[mode]}
      </button>
      <div className="row between small">
        {mode === 'login' ? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); }}>New here? Create account</a> : <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Back to login</a>}
        {mode === 'login' ? <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>Forgot password?</a> : null}
      </div>
      {mode === 'login' ? <button type="button" className="btn ghost block" onClick={() => setMode('otp')}>Log in with email OTP instead</button> : null}
    </form>
  );
}

function GoogleButton({ clientId, onDone }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try { onDone(await api('/auth/google', { method: 'POST', body: { idToken: credential } })); } catch (e) { setError(e.message); }
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 360, text: 'continue_with', shape: 'pill' });
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [clientId, onDone]);
  return <div className="stack" style={{ alignItems: 'center' }}><div ref={ref} />{error ? <div className="error">{error}</div> : null}</div>;
}
