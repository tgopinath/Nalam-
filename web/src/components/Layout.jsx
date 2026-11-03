import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export const NAV = [
  { to: '/', label: 'Home', ico: '🏠', end: true },
  { to: '/food', label: 'Food', ico: '🍽️', feature: 'food_log' },
  { to: '/workouts', label: 'Workouts', ico: '💪' },
  { to: '/progress', label: 'Progress', ico: '📈' },
  { to: '/recipes', label: 'Recipes', ico: '🥗', feature: 'recipes' },
  { to: '/articles', label: 'Learn', ico: '📚', feature: 'articles' },
  { to: '/coach', label: 'Coach', ico: '💬', feature: 'coach' },
  { to: '/premium', label: 'Premium', ico: '⭐' },
  { to: '/profile', label: 'Profile', ico: '👤' },
];
const MOBILE = ['/', '/food', '/workouts', '/progress', '/profile'];

export default function Layout() {
  const { user, access, can, config } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="logo"><img src="/favicon.svg" alt="" />Nalam</Link>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
            <span className="ico">{n.ico}</span>{n.label}
            {n.feature && !can(n.feature) ? <span className="lock">🔒</span> : null}
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        {user?.role === 'admin' ? <NavLink to="/admin" className="nav-link"><span className="ico">🛡️</span>Admin panel</NavLink> : null}
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <h1 style={{ margin: 0 }}>Vanakkam, {user?.name?.split(' ')[0] || 'friend'} 👋</h1>
            <span className="muted small">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <div className="row">
            <AccessBadge access={access} />
            <Link to="/notifications" className="btn ghost sm" aria-label="Notifications">🔔</Link>
          </div>
        </div>
        {config?.announcement ? <div className="banner info mb">📣 {config.announcement}</div> : null}
        <TrialBanner access={access} />
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}><span className="ico">{n.ico}</span>{n.label}</NavLink>
        ))}
      </nav>
    </div>
  );
}

function AccessBadge({ access }) {
  if (!access) return null;
  const map = { premium: ['green', '⭐ Premium'], trial: ['orange', `Trial · ${access.daysLeft}d left`], expired: ['red', 'Free plan'], admin: ['violet', 'Admin'] };
  const [cls, label] = map[access.status];
  return <Link to="/premium" className={`badge ${cls}`}>{label}</Link>;
}

function TrialBanner({ access }) {
  if (!access) return null;
  if (access.status === 'trial' && access.daysLeft <= 3) {
    return (
      <div className="banner trial mb">
        <div><b>Your free trial ends in {access.daysLeft} day{access.daysLeft === 1 ? '' : 's'}.</b><div className="small muted">Subscribe now to keep every feature.</div></div>
        <Link to="/premium" className="btn orange sm">See plans</Link>
      </div>
    );
  }
  if (access.status === 'expired') {
    return (
      <div className="banner expired mb">
        <div><b>Your free trial has ended.</b><div className="small muted">Upgrade to unlock food tracking, all workouts, recipes, coach chat and more.</div></div>
        <Link to="/premium" className="btn sm">Upgrade</Link>
      </div>
    );
  }
  return null;
}
