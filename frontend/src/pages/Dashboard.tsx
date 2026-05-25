import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Play, Users, Network, ArrowRight, TrendingUp, Cpu, HardDrive } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../api/client';
import { GlobalStats, Server as ServerType } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string; delay?: number;
}) {
  return (
    <motion.div {...fadeUp} transition={{ delay, duration: 0.4 }} className="liquid-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

const mockCpuData = Array.from({ length: 20 }, (_, i) => ({ t: i, v: Math.random() * 50 + 10 }));
const mockMemData = Array.from({ length: 20 }, (_, i) => ({ t: i, v: Math.random() * 60 + 20 }));

export default function Dashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [servers, setServers] = useState<ServerType[]>([]);

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data));
    api.get('/servers').then(r => setServers(r.data.slice(0, 5)));
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Welcome */}
      <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-white">Welcome back 👋</h2>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Here's what's happening with your servers.</p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Total Servers" value={stats?.totalServers ?? '—'} sub="Across all nodes" color="#a78bfa" delay={0.05} />
        <StatCard icon={Play} label="Running" value={stats?.runningServers ?? '—'} sub="Active instances" color="#22c55e" delay={0.1} />
        <StatCard icon={Users} label="Users" value={stats?.totalUsers ?? '—'} sub="Registered accounts" color="#38bdf8" delay={0.15} />
        <StatCard icon={Network} label="Nodes" value={`${stats?.onlineNodes ?? '—'}/${stats?.totalNodes ?? '—'}`} sub="Online / Total" color="#f472b6" delay={0.2} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'CPU Usage', data: mockCpuData, color: '#a78bfa', icon: Cpu },
          { label: 'Memory Usage', data: mockMemData, color: '#38bdf8', icon: HardDrive },
        ].map((chart, i) => (
          <motion.div key={chart.label} {...fadeUp} transition={{ delay: 0.25 + i * 0.05 }} className="liquid-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <chart.icon size={15} style={{ color: chart.color }} />
                <span className="text-sm font-medium text-white">{chart.label}</span>
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: '#22c55e' }}>
                <TrendingUp size={12} />
                <span>Live</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={chart.data}>
                <defs>
                  <linearGradient id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chart.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`]}
                  labelFormatter={() => ''}
                />
                <Area type="monotone" dataKey="v" stroke={chart.color} strokeWidth={2} fill={`url(#g${i})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        ))}
      </div>

      {/* Recent servers */}
      <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="liquid-card">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-semibold text-white">Recent Servers</h3>
          <Link to="/servers" className="flex items-center gap-1 text-xs" style={{ color: '#a78bfa' }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {servers.length === 0 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No servers yet</div>
          )}
          {servers.map(server => (
            <Link
              key={server.id}
              to={`/servers/${server.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${server.color}22`, border: `1px solid ${server.color}44` }}
              >
                <EggIcon name={server.icon} size={16} color={server.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">{server.name}</div>
                <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{server.egg_name} • {server.node_name}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>RAM</div>
                  <div className="text-xs text-white font-medium">{server.memory >= 1024 ? `${server.memory/1024}GB` : `${server.memory}MB`}</div>
                </div>
                <StatusBadge status={server.status} />
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
