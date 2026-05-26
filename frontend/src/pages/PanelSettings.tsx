import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Save, TestTube } from 'lucide-react';
import api from '../api/client';
import { toast } from '../components/ui/Toaster';
import { useI18n } from '../hooks/useI18n';

interface PanelSettingsData {
  panel_name: string;
  panel_description: string;
  panel_color: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
}

export default function PanelSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<PanelSettingsData>({
    panel_name: 'Palto-Network',
    panel_description: 'Herní server panel',
    panel_color: '#7c3aed',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: 'noreply@palto-network.io',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        setSettings(s => ({ ...s, ...res.data }));
      } catch {
        toast.error('Nepodařilo se načíst nastavení');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Nastavení uloženo');
    } catch {
      toast.error('Nepodařilo se uložit nastavení');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    setTestingEmail(true);
    try {
      await api.post('/settings/test-email');
      toast.success('Testovací e-mail odeslán');
    } catch {
      toast.error('Nepodařilo se odeslat testovací e-mail');
    } finally {
      setTestingEmail(false);
    }
  };

  const up = (key: keyof PanelSettingsData, val: string) => setSettings(s => ({ ...s, [key]: val }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Branding */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Sparkles size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('panelSettings.branding')}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Přizpůsobte vzhled panelu</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Název panelu</label>
              <input
                className="glass-input w-full px-3 py-2.5 text-sm"
                value={settings.panel_name}
                onChange={e => up('panel_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Barva akcento</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                  value={settings.panel_color}
                  onChange={e => up('panel_color', e.target.value)}
                  style={{ background: 'transparent' }}
                />
                <input
                  className="glass-input flex-1 px-3 py-2.5 text-sm font-mono"
                  value={settings.panel_color}
                  onChange={e => up('panel_color', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Popis panelu</label>
            <input
              className="glass-input w-full px-3 py-2.5 text-sm"
              value={settings.panel_description}
              onChange={e => up('panel_description', e.target.value)}
            />
          </div>
        </div>
      </motion.div>

      {/* SMTP */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.2)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <Mail size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('panelSettings.smtp')}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Konfigurace e-mailu</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>SMTP Host</label>
              <input
                className="glass-input w-full px-3 py-2.5 text-sm"
                placeholder="smtp.gmail.com"
                value={settings.smtp_host}
                onChange={e => up('smtp_host', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Port</label>
              <input
                className="glass-input w-full px-3 py-2.5 text-sm"
                placeholder="587"
                value={settings.smtp_port}
                onChange={e => up('smtp_port', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Uživatel</label>
              <input
                className="glass-input w-full px-3 py-2.5 text-sm"
                placeholder="user@domain.com"
                value={settings.smtp_user}
                onChange={e => up('smtp_user', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Heslo</label>
              <input
                className="glass-input w-full px-3 py-2.5 text-sm"
                type="password"
                placeholder="••••••••"
                value={settings.smtp_pass}
                onChange={e => up('smtp_pass', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>E-mail odesílatele</label>
            <input
              className="glass-input w-full px-3 py-2.5 text-sm"
              placeholder="noreply@palto-network.io"
              value={settings.smtp_from}
              onChange={e => up('smtp_from', e.target.value)}
            />
          </div>
          <button
            onClick={testEmail}
            disabled={testingEmail || !settings.smtp_host}
            className="glass-btn flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-40"
          >
            <TestTube size={15} style={{ color: '#38bdf8' }} />
            {testingEmail ? 'Odesílání...' : t('panelSettings.testEmail')}
          </button>
        </div>
      </motion.div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className="glass-btn glass-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-40"
      >
        <Save size={15} /> {saving ? 'Ukládání...' : t('common.save')}
      </button>
    </div>
  );
}
