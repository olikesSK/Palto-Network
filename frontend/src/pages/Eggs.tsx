import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Egg as EggLucide, Trash2, Edit, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { Egg, EggVariable } from '../types';
import EggIcon from '../components/eggs/EggIcon';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../hooks/useI18n';

export default function Eggs() {
  const [eggs, setEggs] = useState<Egg[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Egg | null>(null);
  const user = useAuthStore(s => s.user);
  const { t } = useI18n();

  useEffect(() => { api.get('/eggs').then(r => setEggs(r.data)); }, []);

  const filtered = eggs.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map(e => e.category))];

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Smazat tento egg?')) return;
    await api.delete(`/eggs/${id}`);
    setEggs(prev => prev.filter(egg => egg.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input className="glass-input w-full pl-10 pr-4 py-2.5 text-sm" placeholder={t('eggs.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {user?.role === 'admin' && (
          <button className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <Plus size={16} /> {t('eggs.import')}
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* Egg list */}
        <div className="flex-1 space-y-5">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.filter(e => e.category === cat).map((egg, i) => (
                  <motion.button
                    key={egg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelected(egg)}
                    className="liquid-card text-left p-4 flex items-center gap-4"
                    style={selected?.id === egg.id ? { borderColor: `${egg.color}60`, background: `${egg.color}12` } : {}}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${egg.color}22`, border: `1px solid ${egg.color}44` }}>
                      <EggIcon name={egg.icon} size={22} color={egg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">{egg.name}</div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{egg.description}</div>
                      <div className="text-xs mt-1 font-mono truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>{egg.docker_image}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {user?.role === 'admin' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); }} className="glass-btn p-1.5">
                            <Edit size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                          </button>
                          <button onClick={e => handleDelete(egg.id, e)} className="glass-btn p-1.5">
                            <Trash2 size={12} style={{ color: '#f87171' }} />
                          </button>
                        </>
                      )}
                      <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="liquid-card p-16 text-center">
              <EggLucide size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-white font-medium">{t('eggs.noEggs')}</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-80 shrink-0 space-y-4">
            <div className="liquid-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${selected.color}22`, border: `1px solid ${selected.color}44` }}>
                  <EggIcon name={selected.icon} size={22} color={selected.color} />
                </div>
                <div>
                  <div className="font-semibold text-white">{selected.name}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selected.category}</div>
                </div>
              </div>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{selected.description}</p>

              <div className="space-y-2">
                {[
                  { label: t('eggs.dockerImage'), value: selected.docker_image },
                  { label: t('eggs.stopCommand'), value: selected.config_stop },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.label}</div>
                    <code className="text-xs" style={{ color: '#a78bfa' }}>{r.value}</code>
                  </div>
                ))}
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('eggs.startupCommand')}</div>
                  <code className="text-xs break-all" style={{ color: '#38bdf8' }}>{selected.startup}</code>
                </div>
              </div>
            </div>

            {/* Variables */}
            {JSON.parse(selected.variables || '[]').length > 0 && (
              <div className="liquid-card p-5">
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('eggs.variables')}</h4>
                <div className="space-y-2">
                  {(JSON.parse(selected.variables) as EggVariable[]).map(v => (
                    <div key={v.name} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <code className="text-xs font-semibold" style={{ color: '#f472b6' }}>{v.name}</code>
                        {v.required && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>{t('eggs.required')}</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.description}</div>
                      {v.default && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('eggs.default')}: {v.default}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
