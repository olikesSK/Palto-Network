import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../ui/Toaster';

interface Schedule {
  id: string;
  server_id: string;
  name: string;
  cron_minute: string;
  cron_hour: string;
  cron_day_month: string;
  cron_month: string;
  cron_day_week: string;
  action: string;
  payload: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

interface ScheduleManagerProps {
  serverId: string;
}

const PRESETS = [
  { label: 'Každý den ve 4:00', minute: '0', hour: '4', dayMonth: '*', month: '*', dayWeek: '*' },
  { label: 'Každou hodinu', minute: '0', hour: '*', dayMonth: '*', month: '*', dayWeek: '*' },
  { label: 'Každých 30 minut', minute: '*/30', hour: '*', dayMonth: '*', month: '*', dayWeek: '*' },
  { label: 'Každou neděli', minute: '0', hour: '3', dayMonth: '*', month: '*', dayWeek: '0' },
  { label: 'Vlastní', minute: '', hour: '', dayMonth: '', month: '', dayWeek: '' },
];

export default function ScheduleManager({ serverId }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [preset, setPreset] = useState(0);
  const [form, setForm] = useState({
    name: '',
    cron_minute: '0',
    cron_hour: '4',
    cron_day_month: '*',
    cron_month: '*',
    cron_day_week: '*',
    action: 'command',
    payload: '',
  });
  const [creating, setCreating] = useState(false);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/servers/${serverId}/schedules`);
      setSchedules(res.data);
    } catch {
      toast.error('Nepodařilo se načíst plány');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    const p = PRESETS[idx];
    if (idx < PRESETS.length - 1) {
      setForm(f => ({
        ...f,
        cron_minute: p.minute,
        cron_hour: p.hour,
        cron_day_month: p.dayMonth,
        cron_month: p.month,
        cron_day_week: p.dayWeek,
      }));
    }
  };

  const createSchedule = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.post(`/servers/${serverId}/schedules`, form);
      toast.success('Plán přidán');
      setShowAdd(false);
      setForm({ name: '', cron_minute: '0', cron_hour: '4', cron_day_month: '*', cron_month: '*', cron_day_week: '*', action: 'command', payload: '' });
      loadSchedules();
    } catch {
      toast.error('Nepodařilo se přidat plán');
    } finally {
      setCreating(false);
    }
  };

  const toggleSchedule = async (sched: Schedule) => {
    try {
      await api.patch(`/servers/${serverId}/schedules/${sched.id}`, { enabled: !sched.enabled });
      toast.success(sched.enabled ? 'Plán zakázán' : 'Plán povolen');
      loadSchedules();
    } catch {
      toast.error('Nepodařilo se změnit plán');
    }
  };

  const deleteSchedule = async (sched: Schedule) => {
    if (!confirm(`Smazat plán "${sched.name}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/schedules/${sched.id}`);
      toast.success('Plán smazán');
      loadSchedules();
    } catch {
      toast.error('Nepodařilo se smazat plán');
    }
  };

  const getCronDescription = (s: Schedule) => {
    const parts = [s.cron_minute, s.cron_hour, s.cron_day_month, s.cron_month, s.cron_day_week];
    return parts.join(' ');
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Plánované úlohy</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="glass-btn glass-btn-primary flex items-center gap-2 px-3 py-2 text-xs"
        >
          <Plus size={13} /> Přidat úlohu
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
              className="liquid-card p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-white">Přidat plánovanou úlohu</h3>
                <button onClick={() => setShowAdd(false)} className="glass-btn p-1.5">
                  <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Název</label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    placeholder="Denní záloha"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                {/* Presets */}
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Frekvence</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => applyPreset(i)}
                        className="px-3 py-1.5 rounded-xl text-xs transition-all"
                        style={{
                          background: preset === i ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${preset === i ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          color: preset === i ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cron fields */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Minuta', key: 'cron_minute' },
                    { label: 'Hodina', key: 'cron_hour' },
                    { label: 'Den', key: 'cron_day_month' },
                    { label: 'Měsíc', key: 'cron_month' },
                    { label: 'Den týdne', key: 'cron_day_week' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.label}</label>
                      <input
                        className="glass-input w-full px-2 py-2 text-sm text-center font-mono"
                        value={form[f.key as keyof typeof form]}
                        onChange={e => { setPreset(PRESETS.length - 1); setForm(p => ({ ...p, [f.key]: e.target.value })); }}
                      />
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Typ akce</label>
                    <select
                      className="glass-input w-full px-3 py-2.5 text-sm"
                      value={form.action}
                      onChange={e => setForm(p => ({ ...p, action: e.target.value, payload: '' }))}
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <option value="command" style={{ background: '#0a0520' }}>Příkaz</option>
                      <option value="power" style={{ background: '#0a0520' }}>Napájení</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {form.action === 'command' ? 'Příkaz' : 'Akce napájení'}
                    </label>
                    {form.action === 'command' ? (
                      <input
                        className="glass-input w-full px-3 py-2.5 text-sm"
                        placeholder="say Záloha serveru..."
                        value={form.payload}
                        onChange={e => setForm(p => ({ ...p, payload: e.target.value }))}
                      />
                    ) : (
                      <select
                        className="glass-input w-full px-3 py-2.5 text-sm"
                        value={form.payload}
                        onChange={e => setForm(p => ({ ...p, payload: e.target.value }))}
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        <option value="restart" style={{ background: '#0a0520' }}>Restart</option>
                        <option value="start" style={{ background: '#0a0520' }}>Spustit</option>
                        <option value="stop" style={{ background: '#0a0520' }}>Zastavit</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={createSchedule}
                    disabled={!form.name || creating}
                    className="glass-btn glass-btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {creating ? 'Přidávání...' : 'Přidat úlohu'}
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
      ) : schedules.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Žádné plánované úlohy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map(sched => (
            <motion.div
              key={sched.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Clock size={16} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{sched.name}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        background: sched.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                        color: sched.enabled ? '#22c55e' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {sched.enabled ? 'Povolena' : 'Zakázána'}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <code className="font-mono text-[11px]" style={{ color: '#38bdf8' }}>{getCronDescription(sched)}</code>
                    {' • '}
                    {sched.action === 'command' ? `Příkaz: ${sched.payload}` : `Napájení: ${sched.payload}`}
                  </div>
                  {sched.next_run && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Příští spuštění: {new Date(sched.next_run).toLocaleString('cs-CZ')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSchedule(sched)}
                  className="glass-btn p-2"
                  title={sched.enabled ? 'Zakázat' : 'Povolit'}
                >
                  {sched.enabled
                    ? <ToggleRight size={18} style={{ color: '#22c55e' }} />
                    : <ToggleLeft size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  }
                </button>
                <button
                  onClick={() => deleteSchedule(sched)}
                  className="glass-btn p-2"
                  title="Smazat"
                >
                  <Trash2 size={14} style={{ color: '#f87171' }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
