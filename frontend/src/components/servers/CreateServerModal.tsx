import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Server } from 'lucide-react';
import api from '../../api/client';
import { Egg, Node, EggVariable } from '../../types';
import EggIcon from '../eggs/EggIcon';

interface Props { onClose: () => void; onCreated: () => void; }

export default function CreateServerModal({ onClose, onCreated }: Props) {
  const [eggs, setEggs] = useState<Egg[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedEgg, setSelectedEgg] = useState<Egg | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'egg' | 'resources'>('details');

  const [form, setForm] = useState({
    name: '', description: '', node_id: '', egg_id: '',
    memory: 1024, disk: 10240, cpu: 100, port: 25565,
    environment: {} as Record<string, string>,
  });

  useEffect(() => {
    api.get('/eggs').then(r => setEggs(r.data));
    api.get('/nodes').then(r => setNodes(r.data));
  }, []);

  const handleEggSelect = (egg: Egg) => {
    setSelectedEgg(egg);
    const vars: EggVariable[] = JSON.parse(egg.variables || '[]');
    const env: Record<string, string> = {};
    vars.forEach(v => { env[v.name] = v.default; });
    setForm(p => ({ ...p, egg_id: egg.id, environment: env }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.node_id || !form.egg_id) return;
    setLoading(true);
    try {
      await api.post('/servers', form);
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(eggs.map(e => e.category))];
  const eggVars: EggVariable[] = selectedEgg ? JSON.parse(selectedEgg.variables || '[]') : [];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{
          background: 'linear-gradient(145deg, rgba(15,5,40,0.95) 0%, rgba(5,10,30,0.97) 100%)',
          backdropFilter: 'blur(60px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed44, #38bdf844)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Server size={16} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Create New Server</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {step === 'details' ? 'Step 1: Basic Info' : step === 'egg' ? 'Step 2: Choose Engine' : 'Step 3: Resources'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass-btn p-2">
            <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {['Details', 'Engine', 'Resources'].map((s, i) => {
            const stepKeys = ['details', 'egg', 'resources'];
            const active = step === stepKeys[i];
            const done = stepKeys.indexOf(step) > i;
            return (
              <div key={s} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{
                  background: done || active ? 'linear-gradient(90deg, #7c3aed, #38bdf8)' : 'transparent',
                  width: active ? '60%' : done ? '100%' : '0%'
                }} />
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {step === 'details' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Server Name *</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" placeholder="My Awesome Server"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Description</label>
                <textarea className="glass-input w-full px-4 py-2.5 text-sm resize-none" rows={3} placeholder="Optional description..."
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Node *</label>
                <select className="glass-input w-full px-4 py-2.5 text-sm"
                  value={form.node_id} onChange={e => setForm(p => ({ ...p, node_id: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <option value="" style={{ background: '#111' }}>Select a node...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id} style={{ background: '#111' }}>{n.name} — {n.fqdn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Default Port</label>
                <input className="glass-input w-full px-4 py-2.5 text-sm" type="number"
                  value={form.port} onChange={e => setForm(p => ({ ...p, port: parseInt(e.target.value) }))} />
              </div>
            </motion.div>
          )}

          {step === 'egg' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {categories.map(cat => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{cat}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {eggs.filter(e => e.category === cat).map(egg => (
                      <button
                        key={egg.id}
                        onClick={() => handleEggSelect(egg)}
                        className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                        style={{
                          background: form.egg_id === egg.id ? `${egg.color}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${form.egg_id === egg.id ? egg.color + '60' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${egg.color}22` }}>
                          <EggIcon name={egg.icon} size={15} color={egg.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{egg.name}</div>
                          <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{egg.docker_image.split(':').pop()}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {step === 'resources' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'memory', label: 'RAM (MB)', min: 128, max: 32768, step: 128 },
                  { key: 'disk', label: 'Disk (MB)', min: 512, max: 512000, step: 512 },
                  { key: 'cpu', label: 'CPU (%)', min: 10, max: 400, step: 10 },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{f.label}</label>
                    <input
                      className="glass-input w-full px-3 py-2.5 text-sm"
                      type="number" min={f.min} max={f.max} step={f.step}
                      value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: parseInt(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>

              {eggVars.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Environment Variables</h4>
                  <div className="space-y-3">
                    {eggVars.map(v => (
                      <div key={v.name}>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {v.name} {v.required && <span style={{ color: '#f87171' }}>*</span>}
                        </label>
                        <input
                          className="glass-input w-full px-3 py-2.5 text-sm"
                          placeholder={v.description}
                          value={form.environment[v.name] || ''}
                          onChange={e => setForm(p => ({ ...p, environment: { ...p.environment, [v.name]: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEgg && (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Startup Command</div>
                  <code className="text-xs" style={{ color: '#a78bfa' }}>{selectedEgg.startup}</code>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setStep(step === 'resources' ? 'egg' : 'details')}
            disabled={step === 'details'}
            className="glass-btn px-5 py-2.5 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {step !== 'resources' ? (
            <button
              onClick={() => setStep(step === 'details' ? 'egg' : 'resources')}
              disabled={step === 'details' ? !form.name || !form.node_id : !form.egg_id}
              className="glass-btn glass-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="glass-btn glass-btn-primary px-6 py-2.5 text-sm font-medium"
            >
              {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</span> : 'Create Server'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
