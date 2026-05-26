import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Server, Play, Users, Network, ArrowRight, Cpu, HardDrive,
  MemoryStick, Database, Activity, Clock, Plus, ChevronRight,
  AlertTriangle, CheckCircle,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import api from '../api/client';
import { GlobalStats, Server as ServerType } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';
import { useI18n } from '../hooks/useI18n';
import { useAuthStore } from '../store/auth';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

interface HistoryPoint { time: string; cpu: number; memory: number; active_servers: number }
interface ActivityEntry {
  id: number; username: string; action: string; resource: string;
  resource_id: string | null; details: string | null; created_at: string;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

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
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

function ResourceBar({ label, used, total, color, unit = 'MB' }: {
  label: string; used: number; total: number; color: string; unit?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const fmt = (v: number) => unit === 'GB' || v >= 1024
    ? `${(v / 1024).toFixed(1)} GB`
    : `${v} MB`;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {fmt(used)} / {fmt(total)} <span style={{ color }}>{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : color,
          }}
        />
      </div>
    </div>
  );
}

function ActionChip({ action }: { action: string }) {
  const map: Record<string, { color: string; label: string }> = {
    create: { color: '#22c55e', label: 'Create' },
    delete: { color: '#ef4444', label: 'Delete' },
    update: { color: '#38bdf8', label: 'Update' },
    start:  { color: '#a78bfa', label: 'Start' },
    stop:   { color: '#f97316', label: 'Stop' },
    login:  { color: '#6b7280', label: 'Login' },
  };
  const found = Object.entries(map).find(([k]) => action.toLowerCase().includes(k));
  const { color, label } = found?.[1] ?? { color: '#6b7280', label: action };
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
      style={{ background: `${color}22`, color }}>
      {label}
    </span>
  );
}

function EmptyChart({ color }: { color: string }) {
  return (
    <div className="h-[90px] flex flex-col items-center justify-center gap-1.5"
      style={{ color: 'rgba(255,255,255,0.2)' }}>
      <Activity size={20} style={{ color }} className="opacity-30" />
      <span className="text-xs">No data yet — starts when servers run</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [servers, setServers] = useState<ServerType[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    const [s, srv, hist, act] = await Promise.allSettled([
      api.get('/stats'),
      api.get('/servers'),
      api.get('/stats/history?period=1h'),
      api.get('/activity?limit=8'),
    ]);
    if (s.status === 'fulfilled') setStats(s.value.data);
    if (srv.status === 'fulfilled') setServers(srv.value.data.slice(0, 6));
    if (hist.status === 'fulfilled') setHistory(hist.value.data);
    if (act.status === 'fulfilled') setActivity(act.value.data);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const hasHistory = history.length > 0;

  const quickActions = [
    { label: 'New Server', to: '/servers', icon: Plus, color: '#7c3aed' },
    { label: 'Manage Users', to: '/users', icon: Users, color: '#38bdf8', adminOnly: true },
    { label: 'View Nodes', to: '/nodes', icon: Network, color: '#f472b6' },
    { label: 'Audit Log', to: '/audit', icon: Clock, color: '#f59e0b', adminOnly: true },
  ].filter(a => !a.adminOnly || isAdmin);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Welcome */}
      <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {t('dashboard.welcome')}, {user?.username} 👋
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        {/* Node health pill */}
        {stats && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: stats.onlineNodes === stats.totalNodes
                ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${stats.onlineNodes === stats.totalNodes ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
              color: stats.onlineNodes === stats.totalNodes ? '#4ade80' : '#fbbf24',
            }}>
            {stats.onlineNodes === stats.totalNodes
              ? <><CheckCircle size={12} /> All nodes operational</>
              : <><AlertTriangle size={12} /> {stats.totalNodes - stats.onlineNodes} node(s) offline</>
            }
          </div>
        )}
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label={t('dashboard.totalServers')} value={stats?.totalServers ?? '—'}
          sub={t('dashboard.acrossNodes')} color="#a78bfa" delay={0.05} />
        <StatCard icon={Play} label={t('dashboard.running')} value={stats?.runningServers ?? '—'}
          sub={t('dashboard.activeInstances')} color="#22c55e" delay={0.1} />
        <StatCard icon={Users} label={t('dashboard.users')} value={stats?.totalUsers ?? '—'}
          sub={t('dashboard.registeredAccounts')} color="#38bdf8" delay={0.15} />
        <StatCard icon={Network} label={t('dashboard.nodes')}
          value={`${stats?.onlineNodes ?? '—'}/${stats?.totalNodes ?? '—'}`}
          sub={t('dashboard.onlineTotal')} color="#f472b6" delay={0.2} />
      </div>

      {/* Charts + resource allocation */}
      <div className="grid grid-cols-3 gap-4">
        {/* CPU chart */}
        <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="liquid-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu size={14} style={{ color: '#a78bfa' }} />
              <span className="text-sm font-medium text-white">{t('dashboard.cpuUsage')}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
              avg across servers
            </span>
          </div>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'CPU']}
                />
                <Area type="monotone" dataKey="cpu" stroke="#a78bfa" strokeWidth={2} fill="url(#gcpu)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart color="#a78bfa" />}
        </motion.div>

        {/* Memory chart */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="liquid-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MemoryStick size={14} style={{ color: '#38bdf8' }} />
              <span className="text-sm font-medium text-white">{t('dashboard.memoryUsage')}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
              avg across servers
            </span>
          </div>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="gmem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Memory']}
                />
                <Area type="monotone" dataKey="memory" stroke="#38bdf8" strokeWidth={2} fill="url(#gmem)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart color="#38bdf8" />}
        </motion.div>

        {/* Resource allocation */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="liquid-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={14} style={{ color: '#f472b6' }} />
            <span className="text-sm font-medium text-white">Resource Allocation</span>
          </div>
          <div className="space-y-4">
            <ResourceBar
              label="RAM Allocated"
              used={stats?.allocatedMemory ?? 0}
              total={stats?.totalMemory ?? 1}
              color="#a78bfa"
            />
            <ResourceBar
              label="Disk Allocated"
              used={stats?.allocatedDisk ?? 0}
              total={stats?.totalDisk ?? 1}
              color="#38bdf8"
            />
            <div className="pt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {stats?.runningServers ?? 0}
              </span> of {stats?.totalServers ?? 0} servers running
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <div className="flex gap-3">
          {quickActions.map(a => (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: `${a.color}18`, border: `1px solid ${a.color}33`, color: a.color }}
            >
              <a.icon size={15} />
              {a.label}
              <ChevronRight size={13} className="opacity-60" />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Bottom row: servers list + activity */}
      <div className="grid grid-cols-5 gap-4">
        {/* Recent servers (3/5) */}
        <motion.div {...fadeUp} transition={{ delay: 0.45 }} className="col-span-3 liquid-card">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Server size={15} style={{ color: '#a78bfa' }} />
              {t('dashboard.recentServers')}
            </h3>
            <Link to="/servers" className="flex items-center gap-1 text-xs transition-colors hover:opacity-70"
              style={{ color: '#a78bfa' }}>
              {t('dashboard.viewAll')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {servers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {t('dashboard.noServers')}
              </div>
            )}
            {servers.map(server => (
              <Link
                key={server.id}
                to={`/servers/${server.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${server.color}22`, border: `1px solid ${server.color}44` }}>
                  <EggIcon name={server.icon} size={15} color={server.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">{server.name}</div>
                  <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {server.egg_name} • {server.node_name}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-medium text-white">
                      {server.memory >= 1024 ? `${(server.memory / 1024).toFixed(server.memory % 1024 === 0 ? 0 : 1)} GB` : `${server.memory} MB`}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {server.disk >= 1024 ? `${Math.round(server.disk / 1024)} GB` : `${server.disk} MB`} disk
                    </div>
                  </div>
                  <StatusBadge status={server.status} />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent activity (2/5) */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }} className="col-span-2 liquid-card flex flex-col">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Activity size={15} style={{ color: '#38bdf8' }} />
              Recent Activity
            </h3>
            {isAdmin && (
              <Link to="/audit" className="flex items-center gap-1 text-xs transition-colors hover:opacity-70"
                style={{ color: '#38bdf8' }}>
                Full log <ArrowRight size={12} />
              </Link>
            )}
          </div>
          <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {activity.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No activity yet
              </div>
            )}
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <ActionChip action={a.action} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {a.username}
                    <span className="font-normal ml-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {a.resource}
                    </span>
                  </div>
                  {a.details && (
                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {a.details}
                    </div>
                  )}
                </div>
                <div className="text-[10px] shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
