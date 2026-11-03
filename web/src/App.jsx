import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Paywall from './components/Paywall.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Food from './pages/Food.jsx';
import Workouts from './pages/Workouts.jsx';
import WorkoutDetail from './pages/WorkoutDetail.jsx';
import Recipes from './pages/Recipes.jsx';
import Articles from './pages/Articles.jsx';
import Coach from './pages/Coach.jsx';
import Progress from './pages/Progress.jsx';
import Profile from './pages/Profile.jsx';
import Subscribe from './pages/Subscribe.jsx';
import Notifications from './pages/Notifications.jsx';
import AdminApp from './admin/AdminApp.jsx';

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  if (!admin && !user.onboarded && user.role !== 'admin' && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const { user, loading, config } = useAuth();
  if (config?.maintenance && user?.role !== 'admin' && !loading && user) {
    return <div className="center-screen"><div className="card narrow"><h2>We'll be right back 🛠️</h2><p className="muted">Nalam is under maintenance. Please check back soon.</p></div></div>;
  }
  return (
    <>
      <Routes>
        <Route path="/login" element={loading ? null : user ? <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace /> : <Login />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/admin/*" element={<Protected admin><AdminApp /></Protected>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="food" element={<Food />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="workouts/:id" element={<WorkoutDetail />} />
          <Route path="recipes" element={<Recipes />} />
          <Route path="recipes/:id" element={<Recipes />} />
          <Route path="articles" element={<Articles />} />
          <Route path="articles/:id" element={<Articles />} />
          <Route path="coach" element={<Coach />} />
          <Route path="progress" element={<Progress />} />
          <Route path="profile" element={<Profile />} />
          <Route path="premium" element={<Subscribe />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Paywall />
    </>
  );
}
