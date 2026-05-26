import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Save, Shield, Smartphone, QrCode, X, Globe } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import api from '../api/client';
import { useI18n, setLanguage as saveLang } from '../hooks/useI18n';
import { toast } from '../components/ui/Toaster';

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const fetchMe = useAuthStore(s => s.fetchMe);
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [showEnable2FA, setShowEnable2FA] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [secret2FA, setSecret2FA] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState((user as { totp_enabled?: number })?.totp_enabled === 1);

  const getRoleLabel = (role?: string) => {
    if (role === 'admin') return t('role.admin');
    if (role === 'helper') return t('role.helper');
    return t('role.user');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirm) { toast.error(t('settings.passwordMismatch')); return; }
    setLoading(true);
    try {
      await api.patch(`/users/${user?.id}`, { username: form.username, email: form.email, ...(form.password ? { password: form.password } : {}) });
      await fetchMe();
      toast.success(t('settings.savedSuccess'));
      setForm(p => ({ ...p, password: '', confirm: '' }));
    } catch {
      toast.error(t('settings.savedError'));
    } finally {
      setLoading(false);
    }
  };

  const handle2FASetup = async () => {
    setLoading2FA(true);
    try {
      const res = await api.get('/auth/2fa/setup');
      setQrUrl(res.data.qrUrl);
      setSecret2FA(res.data.secret);
      setShowEnable2FA(true);
    } catch {
      toast.error('Nepodařilo se načíst 2FA setup');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!totpToken) return;
    setLoading2FA(true);
    try {
      await api.post('/auth/2fa/enable', { token: totpToken, secret: secret2FA });
      toast.success('2FA povolena');
      setShowEnable2FA(false);
      setTotpEnabled(true);
      setTotpToken('');
    } catch {
      toast.error('Neplatný TOTP kód');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!totpToken) return;
    setLoading2FA(true);
    try {
      await api.post('/auth/2fa/disable', { token: totpToken });
      toast.success('2FA zakázána');
      setShowDisable2FA(false);
      setTotpEnabled(false);
      setTotpToken('');
    } catch {
      toast.error('Neplatný TOTP kód');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleLanguage = (l: string) => {
    saveLang(l);
    window.location.reload();
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Profile form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <User size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('settings.profile')}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('settings.profileDesc')}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('settings.username')}</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('settings.email')}</label>
              <input className="glass-input w-full px-4 py-2.5 text-sm" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px' }}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-sm font-medium text-white">{t('settings.changePassword')}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('settings.newPassword')}</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" placeholder={t('settings.passwordPlaceholder')} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('settings.confirmPassword')}</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" type="password" placeholder={t('settings.confirmPlaceholder')} value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="glass-btn glass-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
            <Save size={15} /> {loading ? t('settings.saving') : t('settings.save')}
          </button>
        </form>
      </motion.div>

      {/* Security / 2FA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.2)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <Smartphone size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('settings.security')}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('settings.twofa')}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-3">
            <QrCode size={16} style={{ color: totpEnabled ? '#22c55e' : 'rgba(255,255,255,0.4)' }} />
            <div>
              <div className="text-sm font-medium text-white">
                {totpEnabled ? t('settings.twofaEnabled') : t('settings.twofaDisabled')}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {totpEnabled ? 'Účet je chráněn TOTP' : 'Doporučujeme zapnout pro vyšší bezpečnost'}
              </div>
            </div>
          </div>
          {totpEnabled ? (
            <button
              onClick={() => { setShowDisable2FA(true); setTotpToken(''); }}
              className="glass-btn glass-btn-danger px-4 py-2 text-xs"
            >
              {t('settings.disable2fa')}
            </button>
          ) : (
            <button
              onClick={handle2FASetup}
              disabled={loading2FA}
              className="glass-btn glass-btn-primary px-4 py-2 text-xs disabled:opacity-40"
            >
              {loading2FA ? 'Načítání...' : t('settings.enable2fa')}
            </button>
          )}
        </div>
      </motion.div>

      {/* Language */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Globe size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('settings.language')}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Vyberte jazyk rozhraní</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { code: 'cs', label: 'CS', flag: '🇨🇿' },
            { code: 'sk', label: 'SK', flag: '🇸🇰' },
            { code: 'en', label: 'EN', flag: '🇬🇧' },
          ].map(l => (
            <button
              key={l.code}
              onClick={() => handleLanguage(l.code)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: lang === l.code ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${lang === l.code ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: lang === l.code ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              }}
            >
              <span>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Account info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={16} style={{ color: '#38bdf8' }} />
          <h3 className="font-semibold text-white">{t('settings.accountInfo')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('settings.accountId'), value: user?.id?.slice(0, 8) + '...' },
            { label: t('users.role'), value: getRoleLabel(user?.role) },
            { label: t('settings.memberSince'), value: user ? new Date(user.created_at).toLocaleDateString('cs-CZ') : '—' },
          ].map(r => (
            <div key={r.label} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.label}</div>
              <div className="text-sm font-medium text-white">{r.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Enable 2FA modal */}
      <AnimatePresence>
        {showEnable2FA && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="liquid-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-white">Nastavení 2FA</h3>
                <button onClick={() => setShowEnable2FA(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Naskenujte QR kód v aplikaci Google Authenticator nebo Authy.
                </p>
                {qrUrl && (
                  <div className="flex justify-center p-4 rounded-xl" style={{ background: 'white' }}>
                    <img src={qrUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                )}
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Manuální kód:</p>
                  <code className="text-sm font-mono" style={{ color: '#a78bfa' }}>{secret2FA}</code>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Ověřovací kód</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm text-center font-mono text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    value={totpToken}
                    onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEnable2FA}
                    disabled={totpToken.length !== 6 || loading2FA}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {loading2FA ? 'Ověřování...' : 'Aktivovat 2FA'}
                  </button>
                  <button onClick={() => setShowEnable2FA(false)} className="glass-btn px-4 py-2.5 text-sm">
                    Zrušit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disable 2FA modal */}
      <AnimatePresence>
        {showDisable2FA && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="liquid-card p-6 w-full max-w-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Zakázat 2FA</h3>
                <button onClick={() => setShowDisable2FA(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Zadejte aktuální TOTP kód pro zakázání 2FA.
                </p>
                <input
                  className="glass-input w-full px-3 py-2.5 text-sm text-center font-mono text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable2FA}
                    disabled={totpToken.length !== 6 || loading2FA}
                    className="glass-btn glass-btn-danger flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {loading2FA ? 'Ověřování...' : 'Zakázat 2FA'}
                  </button>
                  <button onClick={() => setShowDisable2FA(false)} className="glass-btn px-4 py-2.5 text-sm">
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
