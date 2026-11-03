import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { POWERED_BY } from './brand';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Contributions from './pages/Contributions';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import Members from './pages/Members';
import Users from './pages/Users';
import MyAccount from './pages/MyAccount';
import AuditLog from './pages/AuditLog';
import Profile from './pages/Profile';
import Broadcast from './pages/Broadcast';
import Minutes from './pages/Minutes';
import Board from './pages/Board';
import Chat from './pages/Chat';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import Statement from './pages/Statement';
import Maintenance from './pages/Maintenance';
import FerranoPages from './pages/FerranoPages';
import GateAccess from './pages/GateAccess';
import Tour from './components/Tour';


function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isStaff = ['admin', 'treasurer'].includes(user?.role);
  const isComms = ['admin', 'treasurer', 'secretary'].includes(user?.role);
  const isFacility = user?.role === 'facility';
  const isGate = user?.role === 'gate';
  // Residents see everything open; staff roles start with the low-traffic
  // groups folded so every menu they own fits above the fold.
  const [closed, setClosed] = useState(
    user?.role === 'member' ? {} : user?.role === 'admin' ? { finance: true, comms: true, community: true } : { community: true }
  );
  const toggleGroup = (k) => setClosed((c) => ({ ...c, [k]: !c[k] }));
  const [tourOpen, setTourOpen] = useState(false);

  // Role-aware navigation groups. Empty groups disappear entirely, so each
  // role only ever sees the menus it actually owns. Facility and Gate get a
  // two-item sidebar: their dashboard, their one tool, their profile.
  const GROUPS = [
    { key: 'household', label: 'My Household', show: user?.role === 'member', items: [
      { to: '/my-account', label: 'My Account', tour: 'nav-my-account' },
      { to: '/statement', label: 'My Statement', tour: 'nav-statement' },
      { to: '/maintenance', label: 'Maintenance', tour: 'nav-maintenance' },
      { to: '/gate-access', label: 'Gate Access', tour: 'nav-gate-access' },
    ] },
    { key: 'finance', label: 'Finance', show: isStaff, items: [
      { to: '/contributions', label: 'Contributions', tour: 'nav-contributions' },
      { to: '/expenses', label: 'Expenses', tour: 'nav-expenses' },
      { to: '/reports', label: 'Reports', tour: 'nav-reports' },
      { to: '/categories', label: 'Categories' },
      { to: '/members', label: 'Members', tour: 'nav-members' },
    ] },
    { key: 'comms', label: 'Communications', show: isComms, items: [
      { to: '/broadcast', label: 'Broadcast' },
    ] },
    { key: 'ops', label: 'Operations', show: !['member'].includes(user?.role), items: [
      { to: '/maintenance', label: 'Maintenance', tour: 'nav-maintenance', show: ['admin', 'facility'].includes(user?.role) },
      { to: '/gate-access', label: 'Gate Access', tour: 'nav-gate-access', show: ['admin', 'gate'].includes(user?.role) || isComms },
    ] },
    { key: 'admin', label: 'Administration', show: isAdmin, items: [
      { to: '/users', label: 'User Management' },
      { to: '/audit-log', label: 'Audit Log' },
    ] },
    { key: 'community', label: 'Community', show: !isFacility && !isGate, items: [
      { to: '/minutes', label: 'Ferrano Minutes', tour: 'nav-minutes' },
      { to: '/board', label: 'Ferrano Board', tour: 'nav-board' },
      { to: '/chat', label: 'Ferrano Chat', tour: 'nav-chat' },
      { to: '/ferrano-pages', label: 'Ferrano Pages', tour: 'nav-ferrano-pages' },
    ] },
    { key: 'account', label: 'Account', show: true, items: [
      { to: '/profile', label: 'My Profile', tour: 'nav-profile' },
    ] },
  ];

  // Offer the guided tour once, on first sign-in ever (per browser).
  useEffect(() => {
    if (localStorage.getItem('fcp-tour-seen')) return;
    const t = setTimeout(() => setTourOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);
  const closeTour = () => {
    localStorage.setItem('fcp-tour-seen', '1');
    setTourOpen(false);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <img src="/favicon.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Ferrano Court</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Portal</div>
          </div>
        </div>
        
        <nav>
          {/* Dashboard — everyone; for Facility & Gate it opens their own desk */}
          <NavLink to="/" end data-tour="nav-dashboard">Dashboard</NavLink>

          {GROUPS.filter((g) => g.show).map((g) => {
            const items = g.items.filter((i) => i.show !== false);
            if (!items.length) return null;
            const open = !closed[g.key];
            return (
              <div className="nav-group" key={g.key}>
                <button
                  type="button"
                  className="nav-group-h"
                  aria-expanded={open}
                  onClick={() => toggleGroup(g.key)}
                >
                  <span>{g.label}</span>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                {open && items.map((i) => (
                  <NavLink key={g.key + i.to} to={i.to} data-tour={i.tour}>{i.label}</NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-name">{user?.name}</div>
          <div className="muted">{user?.role}</div>
          <button className="btn-ghost" onClick={() => setTourOpen(true)}>
            🎓 Take the tour
          </button>
          <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }}>
            Sign out
          </button>
          <div className="powered-by">{POWERED_BY}</div>
        </div>
      </aside>
      <main className="content">{children}</main>
      <Tour open={tourOpen} onClose={closeTour} />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

// Hard role guard: the sidebar hides menus per role, this enforces the same
// matrix on direct URL entry (facility/gate never reach resident pages).
function RoleGate({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to="/" replace />;
}
const RESIDENT_PAGES = ['admin', 'treasurer', 'secretary', 'member'];

function AppRoutes() {
  const page = (el) => <RequireAuth><Layout>{el}</Layout></RequireAuth>;

  return (
    <Routes>
      {/* Public Routes (No Sidebar) */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes (With Sidebar) */}
      <Route path="/" element={page(<Dashboard />)} />
      <Route path="/my-account" element={page(<RoleGate roles={['member']}><MyAccount /></RoleGate>)} />
      <Route path="/statement" element={page(<RoleGate roles={['member']}><Statement /></RoleGate>)} />
      <Route path="/maintenance" element={page(<RoleGate roles={['admin', 'facility', 'member']}><Maintenance /></RoleGate>)} />
      <Route path="/ferrano-pages" element={page(<RoleGate roles={RESIDENT_PAGES}><FerranoPages /></RoleGate>)} />
      <Route path="/gate-access" element={page(<RoleGate roles={[...RESIDENT_PAGES, 'gate']}><GateAccess /></RoleGate>)} />
      <Route path="/profile" element={page(<Profile />)} />
      <Route path="/broadcast" element={page(<RoleGate roles={['admin', 'treasurer', 'secretary']}><Broadcast /></RoleGate>)} />
      <Route path="/audit-log" element={page(<RoleGate roles={['admin']}><AuditLog /></RoleGate>)} />
      <Route path="/expenses" element={page(<RoleGate roles={['admin', 'treasurer']}><Expenses /></RoleGate>)} />
      <Route path="/contributions" element={page(<RoleGate roles={['admin', 'treasurer']}><Contributions /></RoleGate>)} />
      <Route path="/reports" element={page(<RoleGate roles={['admin', 'treasurer']}><Reports /></RoleGate>)} />
      <Route path="/categories" element={page(<RoleGate roles={['admin', 'treasurer']}><Categories /></RoleGate>)} />
      <Route path="/members" element={page(<RoleGate roles={['admin', 'treasurer']}><Members /></RoleGate>)} />
      <Route path="/users" element={page(<RoleGate roles={['admin']}><Users /></RoleGate>)} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failed" element={<PaymentFailure />} />
      
      {/* ✅ FIXED: Added page() wrapper so the sidebar shows up */}
      <Route path="/minutes" element={page(<RoleGate roles={RESIDENT_PAGES}><Minutes /></RoleGate>)} />
      <Route path="/board" element={page(<RoleGate roles={RESIDENT_PAGES}><Board /></RoleGate>)} />
      <Route path="/chat" element={page(<RoleGate roles={RESIDENT_PAGES}><Chat /></RoleGate>)} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}