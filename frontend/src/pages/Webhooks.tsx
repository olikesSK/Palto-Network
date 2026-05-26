import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Bell, BellOff, Send, Check, X, Webhook } from 'lucide-react';
import api from '../api/client';
import { DiscordWebhook } from '../types';
import { useI18n } from '../hooks/useI18n';

const ALL_EVENTS = ['server.start', 'server.stop', 'server.crash', 'server.install', 'user.create'];

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: ALL_EVENTS });
  const [creating, setCreating] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const { t } = useI18n();

  const fetchWebhooks = () => api.get('/webhooks').then(r => setWebhooks(r.data));
  useEffect(() => { fetchWebhooks(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/webhooks', form);
      fetchWebhooks();
      setShowCreate(false);
      setForm({ name: '', url: '', events: ALL_EVENTS });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (wh: DiscordWebhook) => {
    await api.patch(`/webhooks/${wh.id}`, { enabled: wh.enabled === 0 ? 1 : 0 });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat tento webhook?')) return;
    await api.delete(`/webhooks/${id}`);
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const handleTest = async (id: string) => {
    try {
      await api.post(`/webhooks/${id}/test`);
      setTestMsg(t('webhooks.testSuccess'));
      setTimeout(() => setTestMsg(null), 3000);
    } catch {
      setTestMsg('Chyba při odesílání testu');
      setTimeout(() => setTestMsg(null), 3000);
    }
  };

  const getEventLabel = (event: string) => {
    const map: Record<string, string> = {
      'server.start': t('webhooks.serverStart'),
      'server.stop': t('webhooks.serverStop'),
      'server.crash': t('webhooks.serverCrash'),
      'server.install': t('webhooks.serverInstall'),
      'user.create': t('webhooks.userCreate'),
    };
    return map[event] || event;
  };

  const toggleFormEvent = (event: string) => {
    setForm(p => ({
      ...p,
      events: p.events.includes(event)
        ? p.events.filter(e => e !== event)
        : [...p.events, event]
    }));
  };

  return (
    <div className="space-y-5 max-w-[1000px]">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {webhooks.length} webhook{webhooks.length !== 1 ? 'y' : ''}
        </p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
        >
          <Plus size={16} /> {t('webhooks.add')}
        </button>
      </div>

      {testMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          {testMsg}
        </motion.div>
      )}

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-6">
          <h3 className="font-semibold text-white mb-4">{t('webhooks.add')}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('webhooks.name')}</label>
                <input
                  className="glass-input w-full px-4 py-2.5 text-sm"
                  placeholder="Můj Discord webhook"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('webhooks.url')}</label>
                <input
                  className="glass-input w-full px-4 py-2.5 text-sm"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('webhooks.events')}</label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map(event => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleFormEvent(event)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: form.events.includes(event) ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                      color: form.events.includes(event) ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${form.events.includes(event) ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {form.events.includes(event) ? <Check size={11} /> : <X size={11} />}
                    {getEventLabel(event)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="glass-btn glass-btn-primary px-5 py-2.5 text-sm">
                {creating ? t('webhooks.creating') : t('common.create')}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="glass-btn px-5 py-2.5 text-sm">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 && !showCreate ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="liquid-card p-16 text-center">
          <Webhook size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-white">{t('webhooks.noWebhooks')}</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('webhooks.noWebhooksDesc')}</p>
          <button onClick={() => setShowCreate(true)} className="glass-btn glass-btn-primary px-5 py-2.5 text-sm mt-4">
            {t('webhooks.add')}
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh, i) => {
            const events: string[] = JSON.parse(wh.events);
            return (
              <motion.div
                key={wh.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="liquid-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: wh.enabled ? 'rgba(88,101,242,0.2)' : 'rgba(107,114,128,0.15)',
                        border: `1px solid ${wh.enabled ? 'rgba(88,101,242,0.4)' : 'rgba(107,114,128,0.3)'}`,
                      }}
                    >
                      {wh.enabled ? (
                        <Bell size={18} style={{ color: '#5865f2' }} />
                      ) : (
                        <BellOff size={18} style={{ color: '#6b7280' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{wh.name}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: wh.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                            color: wh.enabled ? '#22c55e' : '#9ca3af',
                            border: `1px solid ${wh.enabled ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                          }}
                        >
                          {wh.enabled ? t('webhooks.enabled') : t('webhooks.disabled')}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {wh.url}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {events.map(event => (
                          <span
                            key={event}
                            className="text-[10px] px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}
                          >
                            {getEventLabel(event)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTest(wh.id)}
                      className="glass-btn flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      title={t('webhooks.test')}
                    >
                      <Send size={12} style={{ color: '#38bdf8' }} />
                      {t('webhooks.test')}
                    </button>
                    <button
                      onClick={() => handleToggle(wh)}
                      className="glass-btn px-3 py-1.5 text-xs"
                    >
                      {wh.enabled ? <BellOff size={12} /> : <Bell size={12} />}
                    </button>
                    <button
                      onClick={() => handleDelete(wh.id)}
                      className="glass-btn p-1.5"
                    >
                      <Trash2 size={14} style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
