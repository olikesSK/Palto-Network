import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Square, RefreshCw, Zap, MemoryStick, HardDrive, Cpu, Send, Terminal, BarChart3, Settings, Trash2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import api from '../api/client';
import { Server, ServerStats } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';

type Tab = 'console' | 'stats' | 'settings';

interface ConsoleEntry { line: string; type: string; }

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<Server | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [tab, setTab] = useState<Tab>('console');
  const [console_, setConsole] = useState<ConsoleEntry[]>([]);
  const [cmd, setCmd] = useState('');
  const [statsHistory, setStatsHistory] = useState<ServerStats[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const fetchServer = useCallback(() => {
    if (!id) return;
    api.get(`/servers/${id}`).then(r => setServer(r.data));
    api.get(`/servers/${id}/stats`).then(r => setStats(r.data));
  }, [id]);

  useEffect(() => {
    fetchServer();
    const interval = setInterval(() => {
      if (!id) return;
      api.get(`/servers/${id}/stats`).then(r => {
        setStats(r.data);
        setStatsHistory(prev => [...prev.slice(-30), r.data]);
      });
      api.get(`/servers/${id}`).then(r => setServer(r.data));
    }, 3000);
    return () => clearInterval(interval);
  }, [id, fetchServer]);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    const socket = io('/', { auth: { token } });
    socketRef.current = socket;
    socket.emit('console:attach', id);
    socket.on('console:output', (data: { serverId: string; line: string; type: string }) => {
      if (data.serverId === id) {
        setConsole(prev => [...prev.slice(-500), { line: data.line, type: data.type }]);
      }
    });
    return () => { socket.emit('console:detach', id); socket.disconnect(); };
  }, [id]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [console_]);

  const sendCommand = () => {
    if (!cmd.trim() || !socketRef.current) return;
    socketRef.current.emit('console:command', { serverId: id, command: cmd });
    setCmd('');
  };

  const powerAction = async (action: string) => {
    await api.patch(`/servers/${id}/power`, { action });
    setTimeout(fetchServer, 500);
  };

  if (!server) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: 'console', icon: Terminal, label: 'Console' },
    { key: 'stats', icon: BarChart3, label: 'Statistics' },
    { key: 'settings', icon: Settings, label: 'Settings' },
  ];

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link to="/servers" className="glass-btn p-2.5">
          <ArrowLeft size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </Link>
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${server.color}22`, border: `1px solid ${server.color}44` }}
        >
          <EggIcon name={server.icon} size={20} color={server.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{server.name}</h2>
            <StatusBadge status={server.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {server.egg_name} • {server.node_name} • Port {server.port}
          </p>
        </div>

        {/* Power controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => powerAction('start')}
            disabled={server.status === 'running' || server.status === 'starting'}
            className="glass-btn glass-btn-success flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <Play size={14} /> Start
          </button>
          <button
            onClick={() => powerAction('restart')}
            disabled={server.status !== 'running'}
            className="glass-btn flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <RefreshCw size={14} /> Restart
          </button>
          <button
            onClick={() => powerAction('stop')}
            disabled={server.status === 'stopped' || server.status === 'stopping'}
            className="glass-btn glass-btn-danger flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <Square size={14} /> Stop
          </button>
          <button
            onClick={() => powerAction('kill')}
            className="glass-btn flex items-center gap-2 px-3 py-2 text-sm"
            title="Force kill"
          >
            <Zap size={14} style={{ color: '#f97316' }} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Cpu, label: 'CPU', value: `${stats.cpu.toFixed(1)}%`, bar: stats.cpu / 100, color: '#f472b6' },
            { icon: MemoryStick, label: 'RAM', value: `${(stats.memory / 1024).toFixed(1)} / ${(stats.memory_limit / 1024).toFixed(0)} GB`, bar: stats.memory / stats.memory_limit, color: '#a78bfa' },
            { icon: HardDrive, label: 'Disk', value: `${(stats.disk / 1024).toFixed(1)} / ${(stats.disk_limit / 1024).toFixed(0)} GB`, bar: stats.disk / stats.disk_limit, color: '#38bdf8' },
            { icon: RefreshCw, label: 'Uptime', value: server.status === 'running' ? fmtUptime(stats.uptime) : '—', bar: 0, color: '#22c55e' },
          ].map(r => (
            <motion.div key={r.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="liquid-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <r.icon size={14} style={{ color: r.color }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
              </div>
              <div className="text-base font-semibold text-white">{r.value}</div>
              {r.bar > 0 && (
                <div className="glass-progress mt-2">
                  <div className="glass-progress-fill" style={{ width: `${Math.min(r.bar * 100, 100)}%`, background: r.bar > 0.85 ? '#ef4444' : r.bar > 0.65 ? '#f59e0b' : r.color }} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="liquid-card">
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all relative"
              style={{ color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.45)' }}
            >
              <t.icon size={15} />
              {t.label}
              {tab === t.key && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(90deg, #7c3aed, #38bdf8)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Console */}
        {tab === 'console' && (
          <div>
            <div
              className="h-[420px] overflow-y-auto p-4 console-output"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              {console_.length === 0 && (
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {server.status === 'running' ? 'Waiting for output...' : 'Server is not running. Start it to see console output.'}
                </div>
              )}
              {console_.map((entry, i) => (
                <div key={i} className={`console-line-${entry.type} mb-0.5`}>{entry.line}</div>
              ))}
              <div ref={consoleEndRef} />
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono" style={{ color: '#a78bfa' }}>{'>'}</span>
                <input
                  className="glass-input w-full pl-8 pr-4 py-2.5 text-sm font-mono"
                  placeholder="Enter command..."
                  value={cmd}
                  onChange={e => setCmd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendCommand()}
                  disabled={server.status !== 'running'}
                />
              </div>
              <button onClick={sendCommand} disabled={server.status !== 'running'} className="glass-btn glass-btn-primary px-4 py-2.5 disabled:opacity-40">
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Stats charts */}
        {tab === 'stats' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              {[
                { key: 'cpu' as const, label: 'CPU Usage (%)', color: '#f472b6' },
                { key: 'memory' as const, label: 'Memory Usage (MB)', color: '#a78bfa' },
              ].map(c => (
                <div key={c.key}>
                  <div className="text-sm font-medium mb-3 text-white">{c.label}</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={statsHistory.map((s, i) => ({ i, v: s[c.key] }))}>
                      <defs>
                        <linearGradient id={`sg${c.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v.toFixed(1)]} labelFormatter={() => ''} />
                      <Area type="monotone" dataKey="v" stroke={c.color} strokeWidth={2} fill={`url(#sg${c.key})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {stats && [
                { label: 'Network RX', value: `${(stats.network_rx / 1024).toFixed(1)} KB/s` },
                { label: 'Network TX', value: `${(stats.network_tx / 1024).toFixed(1)} KB/s` },
                { label: 'Memory Limit', value: `${(stats.memory_limit / 1024).toFixed(1)} GB` },
                { label: 'Disk Limit', value: `${(stats.disk_limit / 1024).toFixed(1)} GB` },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                  <span className="font-medium text-white">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Server Name', value: server.name },
                { label: 'Egg Engine', value: server.egg_name },
                { label: 'Node', value: server.node_name },
                { label: 'Owner', value: server.owner_name },
                { label: 'Port', value: String(server.port) },
                { label: 'Created', value: new Date(server.created_at).toLocaleDateString() },
              ].map(r => (
                <div key={r.label} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.label}</div>
                  <div className="text-sm font-medium text-white">{r.value}</div>
                </div>
              ))}
            </div>
            {server.startup && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Startup Command</div>
                <code className="text-sm" style={{ color: '#a78bfa' }}>{server.startup}</code>
              </div>
            )}
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button className="glass-btn glass-btn-danger flex items-center gap-2 px-4 py-2.5 text-sm">
                <Trash2 size={15} /> Delete Server
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
