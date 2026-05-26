import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../hooks/useI18n';

export default function Login() {
  const token = useAuthStore(s => s.token);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #020210 0%, #050520 50%, #020215 100%)' }}
    >
      {/* Orbs */}
      <div className="bg-orb w-[700px] h-[700px]" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)', top: '-200px', left: '-200px' }} />
      <div className="bg-orb w-[600px] h-[600px]" style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)', bottom: '-150px', right: '-150px' }} />
      <div className="bg-orb w-[400px] h-[400px]" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)', top: '30%', right: '5%' }} />

      {/* Floating orbs animation */}
      <motion.div
        className="absolute w-32 h-32 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #a78bfa, transparent)', top: '20%', left: '15%' }}
        animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-20 h-20 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #38bdf8, transparent)', bottom: '25%', right: '20%' }}
        animate={{ y: [0, 20, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Card */}
        <div
          className="iridescent-border"
          style={{ borderRadius: '28px' }}
        >
          <div
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
              backdropFilter: 'blur(60px) saturate(180%)',
              WebkitBackdropFilter: 'blur(60px) saturate(180%)',
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '40px',
            }}
          >
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}
                animate={{ boxShadow: ['0 0 40px rgba(124,58,237,0.4)', '0 0 60px rgba(56,189,248,0.4)', '0 0 40px rgba(124,58,237,0.4)'] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles size={28} className="text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold gradient-text">Palto-Network</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Game Server Panel</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <input
                  className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                  placeholder={t('login.username')}
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <input
                  className="glass-input w-full pl-10 pr-11 py-3 text-sm"
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('login.password')}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400 text-center px-2 py-2 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="glass-btn glass-btn-primary w-full py-3 text-sm font-semibold mt-2"
                style={{ fontSize: '15px' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('login.signingIn')}
                  </span>
                ) : t('login.signIn')}
              </button>
            </form>

            <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('login.default')}: <code className="text-purple-400">admin</code> / <code className="text-purple-400">admin123</code>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
