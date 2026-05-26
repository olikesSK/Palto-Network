import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Plus, X } from 'lucide-react';
import api from '../api/client';
import { toast } from '../components/ui/Toaster';
import { useI18n } from '../hooks/useI18n';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  created_by: string;
  active: number;
  created_at: string;
}

const typeStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
  info: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', color: '#38bdf8', label: 'Info' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: 'Varování' },
  danger: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#f87171', label: 'Nebezpečí' },
};

export default function Announcements() {
  const { t } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch {
      toast.error('Nepodařilo se načíst oznámení');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createAnnouncement = async () => {
    if (!form.title || !form.message) return;
    setCreating(true);
    try {
      await api.post('/announcements', form);
      toast.success('Oznámení vytvořeno');
      setShowCreate(false);
      setForm({ title: '', message: '', type: 'info' });
      load();
    } catch {
      toast.error('Nepodařilo se vytvořit oznámení');
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await api.delete(`/announcements/${id}`);
      toast.success('Oznámení deaktivováno');
      load();
    } catch {
      toast.error('Nepodařilo se deaktivovat oznámení');
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">{t('announcements.title')}</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Správa systémových oznámení
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={15} /> {t('announcements.create')}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="liquid-card py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('announcements.noAnnouncements')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => {
              const style = typeStyles[ann.type] || typeStyles.info;
              return (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl"
                  style={{ background: style.bg, border: `1px solid ${style.border}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${style.color}22`, color: style.color }}>
                          {style.label}
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          od {ann.created_by} • {new Date(ann.created_at).toLocaleString('cs-CZ')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-white">{ann.title}</h4>
                      <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{ann.message}</p>
                    </div>
                    <button
                      onClick={() => deactivate(ann.id)}
                      className="glass-btn p-1.5 shrink-0"
                      title="Deaktivovat"
                    >
                      <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="liquid-card p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-white">Vytvořit oznámení</h3>
                <button onClick={() => setShowCreate(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Nadpis</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="Plánovaná údržba"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Zpráva</label>
                  <textarea
                    className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                    rows={3}
                    placeholder="Popis oznámení..."
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Typ</label>
                  <div className="flex gap-2">
                    {Object.entries(typeStyles).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setForm(p => ({ ...p, type: k }))}
                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: form.type === k ? v.bg : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${form.type === k ? v.border : 'rgba(255,255,255,0.08)'}`,
                          color: form.type === k ? v.color : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={createAnnouncement}
                    disabled={!form.title || !form.message || creating}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {creating ? 'Vytváří se...' : 'Vytvořit oznámení'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="glass-btn px-4 py-2.5 text-sm">
                    Zrušit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
