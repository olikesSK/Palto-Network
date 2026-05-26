import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ClipboardList } from 'lucide-react';
import api from '../api/client';
import { toast } from '../components/ui/Toaster';
import { useI18n } from '../hooks/useI18n';

interface AuditEntry {
  id: number;
  user_id: string | null;
  username: string;
  action: string;
  resource: string;
  resource_id: string | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

function actionColor(action: string): { bg: string; color: string } {
  if (action.includes('create') || action.includes('login')) return { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' };
  if (action.includes('delete')) return { bg: 'rgba(239,68,68,0.12)', color: '#f87171' };
  if (action.includes('update') || action.includes('patch') || action.includes('power')) return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
  return { bg: 'rgba(56,189,248,0.12)', color: '#38bdf8' };
}

export default function AuditLog() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', {
        params: { limit: 200, user: search || undefined, action: actionFilter || undefined }
      });
      setLogs(res.data);
    } catch {
      toast.error('Nepodařilo se načíst audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="max-w-5xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white">{t('audit.title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Přehled všech akcí v panelu
          </p>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
              placeholder="Hledat uživatele..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="glass-input px-3 py-2.5 text-sm"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <option value="" style={{ background: '#0a0520' }}>Všechny akce</option>
            <option value="create" style={{ background: '#0a0520' }}>Vytvoření</option>
            <option value="delete" style={{ background: '#0a0520' }}>Smazání</option>
            <option value="update" style={{ background: '#0a0520' }}>Aktualizace</option>
            <option value="power" style={{ background: '#0a0520' }}>Napájení</option>
          </select>
          <button type="submit" className="glass-btn glass-btn-primary px-4 py-2.5 text-sm">
            Hledat
          </button>
        </form>

        {/* Table */}
        <div className="liquid-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('audit.noLogs')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {[t('audit.username'), t('audit.action'), t('audit.resource'), t('audit.ip'), t('audit.time')].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const colors = actionColor(log.action);
                    return (
                      <tr
                        key={log.id}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-white">{log.username}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: colors.bg, color: colors.color }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {log.resource}
                            {log.resource_id && <span style={{ color: 'rgba(255,255,255,0.3)' }}> #{log.resource_id?.slice(0, 8)}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {log.ip || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {new Date(log.created_at).toLocaleString('cs-CZ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
