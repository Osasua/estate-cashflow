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
  const [tourOpen, setTourOpen] = useState(false);

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
          {/* 1. Dashboard (Everyone) */}
          <NavLink to="/" end data-tour="nav-dashboard">Dashboard</NavLink>
          
          {/* 2. My Account (Residents Only) */}
          {user?.role === 'member' && <NavLink to="/my-account" data-tour="nav-my-account">My Account</NavLink>}
          {user?.role === 'member' && <NavLink to="/statement" data-tour="nav-statement">My Statement</NavLink>}
          
          {/* 3. Staff/Admin Menu */}
          {isStaff && <NavLink to="/contributions" data-tour="nav-contributions">Contributions</NavLink>}
          {isStaff && <NavLink to="/expenses" data-tour="nav-expenses">Expenses</NavLink>}
          {isStaff && <NavLink to="/reports" data-tour="nav-reports">Reports</NavLink>}
          {isComms && <NavLink to="/broadcast">Broadcast</NavLink>}
          {isStaff && <NavLink to="/categories">Categories</NavLink>}
          {isStaff && <NavLink to="/members" data-tour="nav-members">Members</NavLink>}
          {['admin', 'facility'].includes(user?.role) && <NavLink to="/maintenance" data-tour="nav-maintenance">Maintenance</NavLink>}
          
          {/* 4. Admin-only links */}
          {isAdmin && <NavLink to="/users">User Management</NavLink>}
          {isAdmin && <NavLink to="/audit-log">Audit Log</NavLink>}
          
          {/* ✅ NEW: Minutes (Everyone - Residents & Staff) */}
          <NavLink to="/minutes" data-tour="nav-minutes">Minutes</NavLink>
          
          {/* ✅ NEW: Ferrano Board (Everyone) */}
          <NavLink to="/board" data-tour="nav-board">Ferrano Board</NavLink>
          
          {/* ✅ NEW: Community Chat (Everyone) */}
          <NavLink to="/chat" data-tour="nav-chat">Community Chat</NavLink>

          {/* 📇 Ferrano Pages — the resident directory (Everyone) */}
          <NavLink to="/ferrano-pages" data-tour="nav-ferrano-pages">Ferrano Pages</NavLink>

          {/* 🛡 Gate Access — resident-issued visitor codes (Everyone) */}
          <NavLink to="/gate-access" data-tour="nav-gate-access">Gate Access</NavLink>

          {/* Maintenance — residents report & track requests here (staff keep their queue link in the staff menu) */}
          {user?.role === 'member' && <NavLink to="/maintenance" data-tour="nav-maintenance">Maintenance</NavLink>}
          
          {/* 5. My Profile (Everyone, at the bottom) */}
          <NavLink to="/profile" data-tour="nav-profile">My Profile</NavLink>
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
      <Route path="/my-account" element={page(<MyAccount />)} />
      <Route path="/statement" element={page(<Statement />)} />
      <Route path="/maintenance" element={page(<Maintenance />)} />
      <Route path="/ferrano-pages" element={page(<FerranoPages />)} />
      <Route path="/gate-access" element={page(<GateAccess />)} />
      <Route path="/profile" element={page(<Profile />)} />
      <Route path="/broadcast" element={page(<Broadcast />)} />
      <Route path="/audit-log" element={page(<AuditLog />)} />
      <Route path="/expenses" element={page(<Expenses />)} />
      <Route path="/contributions" element={page(<Contributions />)} />
      <Route path="/reports" element={page(<Reports />)} />
      <Route path="/categories" element={page(<Categories />)} />
      <Route path="/members" element={page(<Members />)} />
      <Route path="/users" element={page(<Users />)} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failed" element={<PaymentFailure />} />
      
      {/* ✅ FIXED: Added page() wrapper so the sidebar shows up */}
      <Route path="/minutes" element={page(<Minutes />)} />
      <Route path="/board" element={page(<Board />)} />
      <Route path="/chat" element={page(<Chat />)} />
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