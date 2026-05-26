import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useI18n } from '../../hooks/useI18n';

export default function Header() {
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const { t } = useI18n();

  const titles: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/servers': t('nav.servers'),
    '/eggs': t('nav.eggs'),
    '/nodes': t('nav.nodes'),
    '/users': t('nav.users'),
    '/admin': t('nav.admin'),
    '/settings': t('nav.settings'),
    '/webhooks': t('nav.discord'),
  };

  const title = Object.entries(titles).find(([k]) => location.pathname.startsWith(k))?.[1] ?? 'Palto-Network';

  return (
    <header
      className="flex items-center justify-between px-6 py-4 shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            className="glass-input pl-9 pr-4 py-2 text-sm w-52"
            placeholder={t('header.search')}
          />
        </div>
        <button
          className="glass-btn p-2.5 relative"
          title="Notifikace"
        >
          <Bell size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: '#a78bfa' }}
          />
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)' }}
        >
          {user?.username[0]?.toUpperCase()}
        </div>
      </div>
    </header>
  );
}
