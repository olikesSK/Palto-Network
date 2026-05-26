import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Plus, Trash2, Copy, X, Check } from 'lucide-react';
import api from '../api/client';
import { toast } from '../components/ui/Toaster';
import { useI18n } from '../hooks/useI18n';

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  permissions: string;
  last_used: string | null;
  created_at: string;
}

const PERMISSIONS = [
  { id: 'servers:read', label: 'Číst servery' },
  { id: 'servers:power', label: 'Ovládat napájení' },
  { id: 'servers:files', label: 'Přístup k souborům' },
  { id: 'servers:console', label: 'Přístup ke konzoli' },
];

export default function ApiKeys() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>(['servers:read']);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/apikeys');
      setKeys(res.data);
    } catch {
      toast.error('Nepodařilo se načíst API klíče');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/apikeys', { name, permissions: perms });
      setNewKey(res.data.key);
      setShowCreate(false);
      load();
    } catch {
      toast.error('Nepodařilo se vytvořit API klíč');
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Smazat tento API klíč?')) return;
    try {
      await api.delete(`/apikeys/${id}`);
      toast.success('API klíč smazán');
      load();
    } catch {
      toast.error('Nepodařilo se smazat API klíč');
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API klíč zkopírován');
  };

  const togglePerm = (p: string) => {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">{t('apikeys.title')}</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Spravujte API klíče pro přístup k panelu
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setName(''); setPerms(['servers:read']); }}
            className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={15} /> {t('apikeys.create')}
          </button>
        </div>

        {/* New key display */}
        <AnimatePresence>
          {newKey && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl mb-4"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Key size={14} style={{ color: '#22c55e' }} />
                <span className="text-sm font-semibold text-white">{t('apikeys.saveKey')}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <code
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-mono"
                  style={{ background: 'rgba(0,0,0,0.3)', color: '#22c55e' }}
                >
                  {newKey}
                </code>
                <button onClick={copyKey} className="glass-btn flex items-center gap-1.5 px-3 py-2 text-xs">
                  {copied ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
                  {copied ? 'Zkopírováno' : 'Kopírovat'}
                </button>
                <button onClick={() => setNewKey('')} className="glass-btn p-2">
                  <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keys list */}
        <div className="liquid-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Key size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('apikeys.noKeys')}</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {keys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <Key size={15} style={{ color: '#a78bfa' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{key.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{key.key_preview}</code>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(key.created_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {JSON.parse(key.permissions).map((p: string) => (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.last_used && (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Použit {new Date(key.last_used).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="glass-btn p-2"
                    >
                      <Trash2 size={13} style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
              className="liquid-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-white">{t('apikeys.create')}</h3>
                <button onClick={() => setShowCreate(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('apikeys.name')}</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="Moje aplikace"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('apikeys.permissions')}</label>
                  <div className="space-y-2">
                    {PERMISSIONS.map(p => (
                      <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center"
                          style={{
                            background: perms.includes(p.id) ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${perms.includes(p.id) ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          }}
                          onClick={() => togglePerm(p.id)}
                        >
                          {perms.includes(p.id) && <Check size={10} style={{ color: '#a78bfa' }} />}
                        </div>
                        <div>
                          <div className="text-sm text-white">{p.label}</div>
                          <code className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.id}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={createKey}
                    disabled={!name || creating}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {creating ? 'Vytváří se...' : 'Vytvořit klíč'}
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
