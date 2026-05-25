import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Egg, Network, Users, Settings, LogOut, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/eggs', icon: Egg, label: 'Egg Engines' },
  { to: '/nodes', icon: Network, label: 'Nodes' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className="w-60 flex flex-col py-4 px-3 relative z-10"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(40px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)' }}
        >
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <div className="font-bold text-[15px] text-white leading-tight">Wizz-Craft</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Game Panel</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-1">
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          General
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="px-3 mt-5 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Administration
            </div>
            {adminItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </div>

      {/* User */}
      <div className="space-y-1 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
          Settings
        </NavLink>
        <button onClick={handleLogout} className="sidebar-item w-full text-left" style={{ color: 'rgba(239,68,68,0.7)' }}>
          <LogOut size={16} />
          Sign Out
        </button>
        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed44, #38bdf844)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {user?.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.username}</div>
            <div className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {user?.role === 'admin' ? '✦ Administrator' : 'User'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
