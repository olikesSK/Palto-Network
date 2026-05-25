import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Save, Shield } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import api from '../api/client';

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const fetchMe = useAuthStore(s => s.fetchMe);
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirm) { setMsg('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.patch(`/users/${user?.id}`, { username: form.username, email: form.email, ...(form.password ? { password: form.password } : {}) });
      await fetchMe();
      setMsg('Changes saved successfully!');
      setForm(p => ({ ...p, password: '', confirm: '' }));
    } catch {
      setMsg('Failed to save changes');
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <User size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Profile Settings</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Update your account information</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Username</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px' }}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-sm font-medium text-white">Change Password</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>New Password</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" placeholder="Leave blank to keep current" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Confirm Password</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" placeholder="Repeat new password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
            </div>
          </div>

          {msg && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm px-3 py-2 rounded-xl"
              style={{ background: msg.includes('success') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('success') ? '#22c55e' : '#f87171', border: `1px solid ${msg.includes('success') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {msg}
            </motion.p>
          )}

          <button type="submit" disabled={loading} className="glass-btn glass-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
            <Save size={15} /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>

      {/* Account info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={16} style={{ color: '#38bdf8' }} />
          <h3 className="font-semibold text-white">Account Info</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Account ID', value: user?.id?.slice(0, 8) + '...' },
            { label: 'Role', value: user?.role === 'admin' ? '✦ Administrator' : 'User' },
            { label: 'Member Since', value: user ? new Date(user.created_at).toLocaleDateString() : '—' },
          ].map(r => (
            <div key={r.label} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.label}</div>
              <div className="text-sm font-medium text-white">{r.value}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
