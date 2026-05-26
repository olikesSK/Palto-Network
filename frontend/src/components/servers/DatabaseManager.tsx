import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Plus, Trash2, RefreshCw, Eye, EyeOff, Copy, X } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../ui/Toaster';

interface ServerDatabase {
  id: string;
  server_id: string;
  name: string;
  db_username: string;
  db_password: string;
  host: string;
  port: number;
  created_at: string;
}

interface DatabaseManagerProps {
  serverId: string;
}

export default function DatabaseManager({ serverId }: DatabaseManagerProps) {
  const [databases, setDatabases] = useState<ServerDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [dbName, setDbName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const loadDatabases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/servers/${serverId}/databases`);
      setDatabases(res.data);
    } catch {
      toast.error('Nepodařilo se načíst databáze');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadDatabases(); }, [loadDatabases]);

  const createDatabase = async () => {
    if (!dbName.trim()) return;
    setCreating(true);
    try {
      await api.post(`/servers/${serverId}/databases`, { name: dbName });
      toast.success('Databáze vytvořena');
      setShowAdd(false);
      setDbName('');
      loadDatabases();
    } catch {
      toast.error('Nepodařilo se vytvořit databázi');
    } finally {
      setCreating(false);
    }
  };

  const deleteDatabase = async (db: ServerDatabase) => {
    if (!confirm(`Smazat databázi "${db.name}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/databases/${db.id}`);
      toast.success('Databáze smazána');
      loadDatabases();
    } catch {
      toast.error('Nepodařilo se smazat databázi');
    }
  };

  const rotatePassword = async (db: ServerDatabase) => {
    if (!confirm('Rotovat heslo databáze? Stávající heslo přestane fungovat.')) return;
    try {
      await api.post(`/servers/${serverId}/databases/${db.id}/rotate`);
      toast.success('Heslo rotováno');
      loadDatabases();
    } catch {
      toast.error('Nepodařilo se rotovat heslo');
    }
  };

  const copyConnectionString = (db: ServerDatabase) => {
    const conn = `mysql://${db.db_username}:${db.db_password}@${db.host}:${db.port}/${db.name}`;
    navigator.clipboard.writeText(conn);
    toast.success('Connection string zkopírován');
  };

  const togglePassword = (id: string) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Databáze serveru</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="glass-btn glass-btn-primary flex items-center gap-2 px-3 py-2 text-xs"
        >
          <Plus size={13} /> Přidat databázi
        </button>
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="liquid-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Přidat databázi</h3>
                <button onClick={() => setShowAdd(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Přihlašovací údaje budou automaticky vygenerovány.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Název databáze</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="playerdata"
                    value={dbName}
                    onChange={e => setDbName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createDatabase()}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={createDatabase}
                    disabled={!dbName || creating}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {creating ? 'Vytváří se...' : 'Vytvořit databázi'}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="glass-btn px-4 py-2.5 text-sm">
                    Zrušit
                  </button>
                </div>
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
      ) : databases.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Database size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Žádné databáze</p>
        </div>
      ) : (
        <div className="space-y-3">
          {databases.map(db => (
            <motion.div
              key={db.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Database size={16} style={{ color: '#22c55e' }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white font-mono">{db.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {db.host}:{db.port} • Vytvořeno {new Date(db.created_at).toLocaleDateString('cs-CZ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyConnectionString(db)}
                    className="glass-btn flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                    title="Kopírovat connection string"
                  >
                    <Copy size={12} /> Kopírovat
                  </button>
                  <button
                    onClick={() => rotatePassword(db)}
                    className="glass-btn p-1.5"
                    title="Rotovat heslo"
                  >
                    <RefreshCw size={13} style={{ color: '#f59e0b' }} />
                  </button>
                  <button
                    onClick={() => deleteDatabase(db)}
                    className="glass-btn p-1.5"
                    title="Smazat"
                  >
                    <Trash2 size={13} style={{ color: '#f87171' }} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Uživatelské jméno</div>
                  <div className="text-xs font-mono text-white">{db.db_username}</div>
                </div>
                <div className="px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <div>
                    <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Heslo</div>
                    <div className="text-xs font-mono text-white">
                      {revealedPasswords.has(db.id) ? db.db_password : '••••••••••••'}
                    </div>
                  </div>
                  <button
                    onClick={() => togglePassword(db.id)}
                    className="p-1 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {revealedPasswords.has(db.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
