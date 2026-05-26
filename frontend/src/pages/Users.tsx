import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users as UsersIcon, Plus, Trash2, ShieldCheck, User, Server, Zap, X, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import api from '../api/client';
import { User as UserType } from '../types';
import { useI18n } from '../hooks/useI18n';

interface UserStats {
  user: UserType;
  server_count: number;
  total_memory: number;
  total_cpu: number;
  servers: {
    id: string;
    name: string;
    status: string;
    memory: number;
    cpu: number;
    disk: number;
    node_name: string;
    egg_name: string;
  }[];
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const { t } = useI18n();

  const fetchUsers = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users', form);
      fetchUsers();
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'user' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat tohoto uživatele?')) return;
    await api.delete(`/users/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (selectedUser?.user.id === id) setSelectedUser(null);
  };

  const openUserDetail = async (userId: string) => {
    setLoadingStats(true);
    try {
      const res = await api.get(`/users/${userId}/stats`);
      setSelectedUser(res.data);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'zakladatel') return {
      icon: <ShieldCheck size={11} />,
      label: 'Zakladateľ',
      style: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }
    };
    if (role === 'spravca') return {
      icon: <Zap size={11} />,
      label: 'Správca',
      style: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }
    };
    return {
      icon: <User size={11} />,
      label: 'Užívateľ',
      style: { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }
    };
  };

  const getAvatarBg = (role: string) => {
    if (role === 'zakladatel') return 'rgba(167,139,250,0.2)';
    if (role === 'spravca') return 'rgba(245,158,11,0.2)';
    return 'rgba(255,255,255,0.08)';
  };

  const getStatusColor = (status: string) => {
    if (status === 'running') return '#22c55e';
    if (status === 'stopped') return '#6b7280';
    if (status === 'starting') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {users.length} {t('users.registered')}
        </p>
        <button onClick={() => setShowCreate(true)} className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <Plus size={16} /> {t('users.create')}
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
          <h3 className="font-semibold text-white mb-4">{t('users.create')}</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('users.username')}</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('users.email')}</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Heslo</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('users.role')}</label>
              <select className="glass-input w-full px-4 py-2.5 text-sm" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <option value="user" style={{ background: '#111' }}>Užívateľ</option>
                <option value="spravca" style={{ background: '#111' }}>Správca</option>
                <option value="zakladatel" style={{ background: '#111' }}>Zakladateľ</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={loading} className="glass-btn glass-btn-primary px-5 py-2.5 text-sm">
                {loading ? t('users.creating') : t('users.create')}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="glass-btn px-5 py-2.5 text-sm">{t('common.cancel')}</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="liquid-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {[t('users.username'), t('users.email'), t('users.role'), t('users.servers'), t('users.created'), ''].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const badge = getRoleBadge(u.role);
              return (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="transition-colors hover:bg-white/[0.02] cursor-pointer group" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onClick={() => openUserDetail(u.id)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ background: getAvatarBg(u.role), border: '1px solid rgba(255,255,255,0.1)' }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit" style={badge.style}>
                      {badge.icon}
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <Server size={12} /> {u.server_count ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(u.id)} className="glass-btn p-1.5 opacity-0 group-hover:opacity-100 hover:!opacity-100">
                      <Trash2 size={13} style={{ color: '#f87171' }} />
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('users.noUsers')}</p>
          </div>
        )}
      </div>

      {/* User detail modal */}
      <AnimatePresence>
        {(selectedUser || loadingStats) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg liquid-card p-6 overflow-y-auto"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}
            >
              {loadingStats && !selectedUser ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : selectedUser ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
                        style={{ background: getAvatarBg(selectedUser.user.role), border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        {selectedUser.user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{selectedUser.user.username}</h3>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedUser.user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="glass-btn p-2"
                    >
                      <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                    </button>
                  </div>

                  {/* Role & Date */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="glass-input px-4 py-3 rounded-xl">
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Rola</p>
                      <span className="flex items-center gap-1.5 text-sm font-medium" style={getRoleBadge(selectedUser.user.role).style}>
                        {getRoleBadge(selectedUser.user.role).icon}
                        {getRoleBadge(selectedUser.user.role).label}
                      </span>
                    </div>
                    <div className="glass-input px-4 py-3 rounded-xl">
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Člen od</p>
                      <p className="text-sm text-white">{new Date(selectedUser.created_at).toLocaleDateString('sk-SK')}</p>
                    </div>
                  </div>

                  {/* Resource Summary */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="glass-input px-3 py-3 rounded-xl text-center">
                      <Server size={16} className="mx-auto mb-1" style={{ color: '#a78bfa' }} />
                      <p className="text-lg font-bold text-white">{selectedUser.server_count}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Serverov</p>
                    </div>
                    <div className="glass-input px-3 py-3 rounded-xl text-center">
                      <MemoryStick size={16} className="mx-auto mb-1" style={{ color: '#38bdf8' }} />
                      <p className="text-lg font-bold text-white">{selectedUser.total_memory >= 1024 ? `${(selectedUser.total_memory / 1024).toFixed(1)}G` : `${selectedUser.total_memory}M`}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>RAM</p>
                    </div>
                    <div className="glass-input px-3 py-3 rounded-xl text-center">
                      <Cpu size={16} className="mx-auto mb-1" style={{ color: '#f59e0b' }} />
                      <p className="text-lg font-bold text-white">{selectedUser.total_cpu}%</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>CPU</p>
                    </div>
                  </div>

                  {/* Servers list */}
                  {selectedUser.servers.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Servery</h4>
                      <div className="space-y-2">
                        {selectedUser.servers.map(s => (
                          <div key={s.id} className="glass-input px-4 py-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full" style={{ background: getStatusColor(s.status) }} />
                              <div>
                                <p className="text-sm font-medium text-white">{s.name}</p>
                                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.egg_name} · {s.node_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                              <span className="flex items-center gap-1"><MemoryStick size={11} /> {s.memory}MB</span>
                              <span className="flex items-center gap-1"><Cpu size={11} /> {s.cpu}%</span>
                              <span className="flex items-center gap-1"><HardDrive size={11} /> {Math.round(s.disk / 1024)}GB</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedUser.servers.length === 0 && (
                    <div className="text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <Server size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Žiadne servery</p>
                    </div>
                  )}

                  <div className="flex justify-end mt-5">
                    <button
                      onClick={() => handleDelete(selectedUser.user.id)}
                      className="glass-btn flex items-center gap-2 px-4 py-2 text-sm"
                      style={{ color: '#f87171' }}
                    >
                      <Trash2 size={14} />
                      Vymazať používateľa
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
