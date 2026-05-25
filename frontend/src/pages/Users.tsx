import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Plus, Trash2, ShieldCheck, User, Server } from 'lucide-react';
import api from '../api/client';
import { User as UserType } from '../types';

export default function Users() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);

  const fetchUsers = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/users', form); fetchUsers(); setShowCreate(false); setForm({ username: '', email: '', password: '', role: 'user' }); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await api.delete(`/users/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowCreate(true)} className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <Plus size={16} /> Create User
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
          <h3 className="font-semibold text-white mb-4">Create User</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Username</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Password</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Role</label>
              <select className="glass-input w-full px-4 py-2.5 text-sm" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <option value="user" style={{ background: '#111' }}>User</option>
                <option value="admin" style={{ background: '#111' }}>Admin</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={loading} className="glass-btn glass-btn-primary px-5 py-2.5 text-sm">
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="glass-btn px-5 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="liquid-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['User', 'Email', 'Role', 'Servers', 'Created', ''].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ background: u.role === 'admin' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white">{u.username}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
                    style={u.role === 'admin'
                      ? { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }
                      : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {u.role === 'admin' ? <ShieldCheck size={11} /> : <User size={11} />}
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <Server size={12} /> {u.server_count ?? 0}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5">
                  <button onClick={() => handleDelete(u.id)} className="glass-btn p-1.5 opacity-0 group-hover:opacity-100 hover:!opacity-100">
                    <Trash2 size={13} style={{ color: '#f87171' }} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
