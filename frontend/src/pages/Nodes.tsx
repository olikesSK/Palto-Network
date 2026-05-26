import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Server, MemoryStick, HardDrive, Cpu, Plus, Wifi, WifiOff } from 'lucide-react';
import api from '../api/client';
import { Node } from '../types';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../hooks/useI18n';

export default function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const user = useAuthStore(s => s.user);
  const { t } = useI18n();

  useEffect(() => { api.get('/nodes').then(r => setNodes(r.data)); }, []);

  const statusIcon = (s: string) => s === 'online'
    ? <Wifi size={14} style={{ color: '#22c55e' }} />
    : <WifiOff size={14} style={{ color: '#ef4444' }} />;

  const statusColor = (s: string) => ({
    online: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
    offline: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    maintenance: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  }[s] ?? { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: 'rgba(107,114,128,0.3)' });

  const statusLabel = (s: string) => {
    if (s === 'online') return t('nodes.online');
    if (s === 'offline') return t('nodes.offline');
    if (s === 'maintenance') return t('nodes.maintenance');
    return s;
  };

  const pct = (used: number, total: number) => Math.min((used / total) * 100, 100);
  const barColor = (p: number) => p > 85 ? '#ef4444' : p > 65 ? '#f59e0b' : '#22c55e';

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {nodes.length} {nodes.length === 1 ? t('nodes.configured1') : t('nodes.configured')}
        </p>
        {user?.role === 'zakladatel' && (
          <button className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <Plus size={16} /> {t('nodes.add')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {nodes.map((node, i) => {
          const sc = statusColor(node.status);
          const memPct = pct(node.used_memory, node.memory);
          const diskPct = pct(node.used_disk, node.disk);
          const cpuPct = pct(node.used_cpu, node.cpu);

          return (
            <motion.div key={node.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="liquid-card p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
                    <Network size={20} style={{ color: '#38bdf8' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{node.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{node.fqdn}:{node.port}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                  >
                    {statusIcon(node.status)}
                    {statusLabel(node.status)}
                  </span>
                </div>
              </div>

              {/* Server count */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Server size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {node.server_count} {t('nodes.allocated')}
                </span>
              </div>

              {/* Resource bars */}
              <div className="space-y-3">
                {[
                  { icon: MemoryStick, label: t('nodes.memory'), used: node.used_memory, total: node.memory, unit: 'MB', pct: memPct, color: '#a78bfa' },
                  { icon: HardDrive, label: t('nodes.disk'), used: node.used_disk, total: node.disk, unit: 'MB', pct: diskPct, color: '#38bdf8' },
                  { icon: Cpu, label: t('nodes.cpu'), used: node.used_cpu, total: node.cpu, unit: '%', pct: cpuPct, color: '#f472b6' },
                ].map(r => (
                  <div key={r.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <r.icon size={12} style={{ color: r.color }} />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                      </div>
                      <span className="text-xs font-medium text-white">
                        {r.used.toLocaleString()} / {r.total.toLocaleString()} {r.unit}
                      </span>
                    </div>
                    <div className="glass-progress">
                      <div className="glass-progress-fill" style={{ width: `${r.pct}%`, background: barColor(r.pct) }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
