import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Egg, Network, Users, Settings, LogOut, Sparkles, ShieldCheck, Bell, ClipboardList, Megaphone, SlidersHorizontal, Key } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../hooks/useI18n';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return t('role.admin');
    if (role === 'helper') return t('role.helper');
    return t('role.user');
  };

  const getRoleColor = (role: string) => {
    if (role === 'admin') return '#a78bfa';
    if (role === 'helper') return '#f59e0b';
    return 'rgba(255,255,255,0.4)';
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
          <div className="font-bold text-[15px] text-white leading-tight">Palto-Network</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Game Panel</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {t('nav.general')}
        </div>
        {[
          { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
          { to: '/servers', icon: Server, label: t('nav.servers') },
          { to: '/eggs', icon: Egg, label: t('nav.eggs') },
          { to: '/nodes', icon: Network, label: t('nav.nodes') },
        ].map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        {/* User section */}
        <div className="px-3 mt-4 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Moje
        </div>
        <NavLink to="/apikeys" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <Key size={16} />
          {t('nav.apikeys')}
        </NavLink>

        {(user?.role === 'admin' || user?.role === 'helper') && (
          <>
            <div className="px-3 mt-4 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('nav.administration')}
            </div>
            {user?.role === 'admin' && (
              <>
                <NavLink to="/users" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <Users size={16} />
                  {t('nav.users')}
                </NavLink>
                <NavLink to="/admin" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <ShieldCheck size={16} />
                  {t('nav.admin')}
                </NavLink>
                <NavLink to="/webhooks" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <Bell size={16} />
                  {t('nav.discord')}
                </NavLink>
                <NavLink to="/audit" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <ClipboardList size={16} />
                  {t('nav.audit')}
                </NavLink>
                <NavLink to="/announcements" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <Megaphone size={16} />
                  {t('nav.announcements')}
                </NavLink>
                <NavLink to="/panel-settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                  <SlidersHorizontal size={16} />
                  {t('nav.panel')}
                </NavLink>
              </>
            )}
          </>
        )}
      </div>

      {/* User */}
      <div className="space-y-1 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
          {t('nav.settings')}
        </NavLink>
        <button onClick={handleLogout} className="sidebar-item w-full text-left" style={{ color: 'rgba(239,68,68,0.7)' }}>
          <LogOut size={16} />
          {t('nav.logout')}
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
            <div className="text-[11px] truncate font-medium" style={{ color: getRoleColor(user?.role ?? 'user') }}>
              {getRoleLabel(user?.role ?? 'user')}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
