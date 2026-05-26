import { Outlet, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatWidget from '../chat/ChatWidget';
import GlassToaster from '../ui/Toaster';
import { useGlobalKeyboard } from '../../hooks/useKeyboard';
import api from '../../api/client';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
}

const typeColors: Record<string, { bg: string; border: string; color: string }> = {
  info: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', color: '#38bdf8' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
  danger: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', color: '#f87171' },
};

function AnnouncementBanner({ ann, onDismiss }: { ann: Announcement; onDismiss: (id: string) => void }) {
  const c = typeColors[ann.type] || typeColors.info;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{ background: c.bg, borderBottom: `1px solid ${c.border}` }}
    >
      <span style={{ color: c.color }} className="font-semibold shrink-0">{ann.title}:</span>
      <span className="flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{ann.message}</span>
      <button
        onClick={() => onDismiss(ann.id)}
        className="p-0.5 shrink-0 transition-colors hover:opacity-70"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

function InnerLayout() {
  useGlobalKeyboard();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('wizz_dismissed_anns') || '[]'));
    } catch { return new Set(); }
  });

  useEffect(() => {
    api.get('/announcements').then(r => setAnnouncements(r.data)).catch(() => {});
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem('wizz_dismissed_anns', JSON.stringify(Array.from(next)));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#050510' }}>
      {/* Background orbs */}
      <div className="bg-orb w-[600px] h-[600px] opacity-25" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', top: '-150px', left: '-100px' }} />
      <div className="bg-orb w-[500px] h-[500px] opacity-20" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)', bottom: '-100px', right: '10%' }} />
      <div className="bg-orb w-[400px] h-[400px] opacity-15" style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)', top: '40%', right: '-100px' }} />

      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Header />
        {/* Announcement banners */}
        <AnimatePresence>
          {visible.map(ann => (
            <AnnouncementBanner key={ann.id} ann={ann} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
      <GlassToaster />
    </div>
  );
}

export default function Layout() {
  const token = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <InnerLayout />;
}
