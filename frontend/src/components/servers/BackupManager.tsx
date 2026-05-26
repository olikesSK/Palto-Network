import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../ui/Toaster';

interface Backup {
  id: string;
  server_id: string;
  name: string;
  size: number;
  status: 'pending' | 'completed' | 'failed';
  note: string;
  created_at: string;
}

interface BackupManagerProps {
  serverId: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Probíhá' },
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Dokončeno' },
    failed: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Selhalo' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function BackupManager({ serverId }: BackupManagerProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', note: '' });
  const [creating, setCreating] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<Backup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Backup | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/servers/${serverId}/backups`);
      setBackups(res.data);
    } catch {
      toast.error('Nepodařilo se načíst zálohy');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  // Auto-refresh pending backups
  useEffect(() => {
    const hasPending = backups.some(b => b.status === 'pending');
    if (!hasPending) return;
    const t = setTimeout(loadBackups, 3000);
    return () => clearTimeout(t);
  }, [backups, loadBackups]);

  const createBackup = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.post(`/servers/${serverId}/backups`, form);
      toast.success('Záloha spuštěna');
      setShowCreate(false);
      setForm({ name: '', note: '' });
      loadBackups();
    } catch {
      toast.error('Nepodařilo se vytvořit zálohu');
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backup: Backup) => {
    try {
      await api.post(`/servers/${serverId}/backups/${backup.id}/restore`);
      toast.success('Obnova zálohy spuštěna');
      setConfirmRestore(null);
    } catch {
      toast.error('Nepodařilo se obnovit zálohu');
    }
  };

  const deleteBackup = async (backup: Backup) => {
    try {
      await api.delete(`/servers/${serverId}/backups/${backup.id}`);
      toast.success('Záloha smazána');
      setConfirmDelete(null);
      loadBackups();
    } catch {
      toast.error('Nepodařilo se smazat zálohu');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Zálohy serveru</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="glass-btn glass-btn-primary flex items-center gap-2 px-3 py-2 text-xs"
        >
          <Plus size={13} /> Vytvořit zálohu
        </button>
      </div>

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
              className="liquid-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Vytvořit zálohu</h3>
                <button onClick={() => setShowCreate(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Název zálohy</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="Záloha před updatem"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Poznámka</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="Volitelná poznámka..."
                    value={form.note}
                    onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={createBackup}
                    disabled={!form.name || creating}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {creating ? 'Vytváří se...' : 'Vytvořit zálohu'}
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

      {/* Restore confirmation */}
      <AnimatePresence>
        {confirmRestore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="liquid-card p-6 w-full max-w-sm"
            >
              <h3 className="font-semibold text-white mb-2">Obnovit zálohu?</h3>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Server bude restartován a data obnovena ze zálohy "{confirmRestore.name}".
              </p>
              <div className="flex gap-2">
                <button onClick={() => restoreBackup(confirmRestore)} className="glass-btn glass-btn-primary flex-1 py-2">
                  Obnovit
                </button>
                <button onClick={() => setConfirmRestore(null)} className="glass-btn flex-1 py-2">
                  Zrušit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="liquid-card p-6 w-full max-w-sm"
            >
              <h3 className="font-semibold text-white mb-2">Smazat zálohu?</h3>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Tato akce je nevratná. Záloha "{confirmDelete.name}" bude trvale smazána.
              </p>
              <div className="flex gap-2">
                <button onClick={() => deleteBackup(confirmDelete)} className="glass-btn glass-btn-danger flex-1 py-2">
                  Smazat
                </button>
                <button onClick={() => setConfirmDelete(null)} className="glass-btn flex-1 py-2">
                  Zrušit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <HardDrive size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Žádné zálohy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map(backup => (
            <motion.div
              key={backup.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <HardDrive size={16} style={{ color: '#38bdf8' }} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{backup.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {formatSize(backup.size)} • {new Date(backup.created_at).toLocaleString('cs-CZ')}
                    {backup.note && ` • ${backup.note}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={backup.status} />
                {backup.status === 'completed' && (
                  <button
                    onClick={() => setConfirmRestore(backup)}
                    className="glass-btn flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    title="Obnovit"
                  >
                    <RotateCcw size={12} /> Obnovit
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(backup)}
                  className="glass-btn p-1.5"
                  title="Smazat"
                >
                  <Trash2 size={13} style={{ color: '#f87171' }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
