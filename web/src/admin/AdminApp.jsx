import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Overview from './Overview.jsx';
import Users from './Users.jsx';
import Payments from './Payments.jsx';
import Settings from './Settings.jsx';
import CoachInbox from './CoachInbox.jsx';
import Broadcast from './Broadcast.jsx';
import { CONTENT, ContentAdmin } from './Content.jsx';

const NAV = [
  ['', '📊', 'Overview'], ['users', '👥', 'Users'], ['payments', '💳', 'Payments'], ['plans', '⭐', 'Plans'], ['coupons', '🏷️', 'Coupons'],
  ['workouts', '💪', 'Workouts'], ['exercises', '🤸', 'Exercises'], ['foods', '🍛', 'Foods'], ['recipes', '🥗', 'Recipes'], ['articles', '📚', 'Articles'],
  ['coach', '💬', 'Coach inbox'], ['notifications', '📣', 'Notifications'], ['settings', '⚙️', 'App settings'],
];

export default function AdminApp() {
  const { user, signOut } = useAuth();
  return (
    <div className="app admin">
      <aside className="sidebar" style={{ overflowY: 'auto' }}>
        <Link to="/admin" className="logo"><img src="/favicon.svg" alt="" />Nalam Admin</Link>
        {NAV.map(([to, ico, label]) => <NavLink key={to} to={`/admin/${to}`} end={to === ''} className="nav-link"><span className="ico">{ico}</span>{label}</NavLink>)}
        <div className="sidebar-spacer" />
        <Link to="/" className="nav-link"><span className="ico">📱</span>Open user app</Link>
        <button className="nav-link" style={{ background: 'none', border: 0, font: 'inherit', cursor: 'pointer' }} onClick={signOut}><span className="ico">🚪</span>Log out</button>
      </aside>
      <main className="main" style={{ maxWidth: 1280 }}>
        <div className="admin-mobile-nav">
          {NAV.map(([to, ico, label]) => <NavLink key={to} to={`/admin/${to}`} end={to === ''} className="chip">{ico} {label}</NavLink>)}
          <Link to="/" className="chip">📱 App</Link>
        </div>
        <div className="row between mb"><span className="muted small">Signed in as {user.email || user.phone}</span></div>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="payments" element={<Payments />} />
          {Object.keys(CONTENT).map((k) => <Route key={k} path={k} element={<ContentAdmin kind={k} />} />)}
          <Route path="coach" element={<CoachInbox />} />
          <Route path="notifications" element={<Broadcast />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
