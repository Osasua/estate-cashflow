import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
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

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isStaff = ['admin', 'treasurer'].includes(user?.role);

  return (
    <div className="app">
      <aside className="sidebar">
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
  <img src="/favicon.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
  <div>
    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Ferrano Court</div>
    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#9ca3af' }}>Portal</div>
  </div>
</div>
        <nav>
          {/* 1. Dashboard (Everyone) */}
          <NavLink to="/" end>Dashboard</NavLink>
          
          {/* 2. My Account (Residents Only) */}
          {!isStaff && <NavLink to="/my-account">My Account</NavLink>}
          
          {/* 3. Staff/Admin Menu */}
          {isStaff && <NavLink to="/contributions">Contributions</NavLink>}
          {isStaff && <NavLink to="/expenses">Expenses</NavLink>}
          {isStaff && <NavLink to="/reports">Reports</NavLink>}
          {isStaff && <NavLink to="/broadcast">Broadcast</NavLink>}
          {isStaff && <NavLink to="/members">Members</NavLink>}
          {isStaff && <NavLink to="/categories">Categories</NavLink>}
          
          {/* 4. My Profile (Everyone) */}
          <NavLink to="/profile">My Profile</NavLink>
          
          {/* 5. Admin-only links */}
          {isAdmin && <NavLink to="/users">User Management</NavLink>}
          {isAdmin && <NavLink to="/audit-log">Audit Log</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{user?.name}</div>
          <div className="muted">{user?.role}</div>
          <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  // This helper wraps the page in Auth check AND the Layout (which contains the Sidebar)
  const page = (el) => <RequireAuth><Layout>{el}</Layout></RequireAuth>;

  return (
    <Routes>
      {/* Public Routes (No Sidebar) */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes (With Sidebar) */}
      <Route path="/" element={page(<Dashboard />)} />
      <Route path="/my-account" element={page(<MyAccount />)} />
      <Route path="/profile" element={page(<Profile />)} />
      <Route path="/broadcast" element={page(<Broadcast />)} />
      <Route path="/audit-log" element={page(<AuditLog />)} />
      <Route path="/expenses" element={page(<Expenses />)} />
      <Route path="/contributions" element={page(<Contributions />)} />
      <Route path="/reports" element={page(<Reports />)} />
      <Route path="/categories" element={page(<Categories />)} />
      <Route path="/members" element={page(<Members />)} />
      <Route path="/users" element={page(<Users />)} />
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