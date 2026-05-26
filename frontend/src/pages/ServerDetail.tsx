import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Square, RefreshCw, Zap, MemoryStick, HardDrive, Cpu, Send, Terminal, BarChart3, Settings, Trash2, Shield, Plus, X, Check, FolderOpen, Archive, Clock, Database, Users, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import api from '../api/client';
import { Server, ServerStats, SubUser, User } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';
import { useI18n } from '../hooks/useI18n';
import { useAuthStore } from '../store/auth';
import FileManager from '../components/servers/FileManager';
import BackupManager from '../components/servers/BackupManager';
import ScheduleManager from '../components/servers/ScheduleManager';
import DatabaseManager from '../components/servers/DatabaseManager';
import { toast } from '../components/ui/Toaster';
import { AnimatePresence } from 'framer-motion';

type Tab = 'console' | 'stats' | 'files' | 'backups' | 'schedules' | 'databases' | 'players' | 'permissions' | 'settings';

interface ConsoleEntry { line: string; type: string; }

interface PermissionSet {
  console: boolean;
  power: boolean;
  files: boolean;
  settings: boolean;
}

const PLAYER_NAMES = ['Steve', 'Alex', 'Notch', 'Herobrine', 'Creeper', 'Enderman', 'PaltoPlayer', 'ProGamer', 'DiamondKing', 'SkyWatcher'];

function generatePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: PLAYER_NAMES[i % PLAYER_NAMES.length],
    ping: Math.floor(Math.random() * 100) + 20,
    playtime: `${Math.floor(Math.random() * 5)}h ${Math.floor(Math.random() * 60)}m`,
  }));
}

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const currentUser = useAuthStore(s => s.user);
  const [server, setServer] = useState<Server | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [tab, setTab] = useState<Tab>('console');
  const [console_, setConsole] = useState<ConsoleEntry[]>([]);
  const [cmd, setCmd] = useState('');
  const [statsHistory, setStatsHistory] = useState<ServerStats[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Permissions tab state
  const [subusers, setSubusers] = useState<SubUser[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPerms, setNewPerms] = useState<PermissionSet>({ console: true, power: true, files: false, settings: false });
  const [addingUser, setAddingUser] = useState(false);

  // Reinstall modal
  const [showReinstall, setShowReinstall] = useState(false);
  const [reinstalling, setReinstalling] = useState(false);

  // Simulated players
  const [players] = useState(() => generatePlayers(Math.floor(Math.random() * 5) + 1));

  const fetchServer = useCallback(() => {
    if (!id) return;
    api.get(`/servers/${id}`).then(r => setServer(r.data));
    api.get(`/servers/${id}/stats`).then(r => setStats(r.data));
  }, [id]);

  const fetchSubusers = useCallback(() => {
    if (!id) return;
    api.get(`/servers/${id}/subusers`).then(r => setSubusers(r.data)).catch(() => {});
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

  useEffect(() => {
    if (tab === 'permissions') {
      fetchSubusers();
      if (currentUser?.role === 'zakladatel') {
        api.get('/users').then(r => setAllUsers(r.data)).catch(() => {});
      }
    }
  }, [tab, fetchSubusers, currentUser]);

  const sendCommand = () => {
    if (!cmd.trim() || !socketRef.current) return;
    socketRef.current.emit('console:command', { serverId: id, command: cmd });
    setCmd('');
  };

  const powerAction = async (action: string) => {
    try {
      await api.patch(`/servers/${id}/power`, { action });
      const labels: Record<string, string> = { start: 'Server spouštění...', stop: 'Server zastavování...', restart: 'Server restartování...', kill: 'Server ukončen' };
      toast.success(labels[action] || 'Akce provedena');
      setTimeout(fetchServer, 500);
    } catch {
      toast.error('Akce selhala');
    }
  };

  const handleReinstall = async () => {
    setReinstalling(true);
    try {
      await api.post(`/servers/${id}/reinstall`);
      toast.success('Přeinstalace spuštěna');
      setShowReinstall(false);
      setTimeout(fetchServer, 1000);
    } catch {
      toast.error('Přeinstalace selhala');
    } finally {
      setReinstalling(false);
    }
  };

  const handleAddSubuser = async () => {
    if (!selectedUserId) return;
    setAddingUser(true);
    try {
      await api.post(`/servers/${id}/subusers`, { user_id: selectedUserId, permissions: newPerms });
      toast.success('Uživatel přidán');
      fetchSubusers();
      setShowAddUser(false);
      setSelectedUserId('');
      setNewPerms({ console: true, power: true, files: false, settings: false });
    } catch {
      toast.error('Nepodařilo se přidat uživatele');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveSubuser = async (userId: string) => {
    if (!confirm('Odebrat tohoto uživatele?')) return;
    try {
      await api.delete(`/servers/${id}/subusers/${userId}`);
      toast.success('Uživatel odebrán');
      fetchSubusers();
    } catch {
      toast.error('Nepodařilo se odebrat uživatele');
    }
  };

  const handleUpdatePerms = async (userId: string, perms: PermissionSet) => {
    try {
      await api.patch(`/servers/${id}/subusers/${userId}`, { permissions: perms });
      fetchSubusers();
    } catch {
      toast.error('Nepodařilo se aktualizovat oprávnění');
    }
  };

  if (!server) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const isOwnerOrAdmin = currentUser?.role === 'zakladatel' || currentUser?.role === 'spravca' || server.owner_id === currentUser?.id;

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: 'console', icon: Terminal, label: t('server.console') },
    { key: 'stats', icon: BarChart3, label: t('server.stats') },
    { key: 'files', icon: FolderOpen, label: t('server.files') },
    { key: 'backups', icon: Archive, label: t('server.backups') },
    { key: 'schedules', icon: Clock, label: t('server.schedules') },
    { key: 'databases', icon: Database, label: t('server.databases') },
    { key: 'players', icon: Users, label: t('server.players') },
    { key: 'permissions', icon: Shield, label: t('server.permissions') },
    { key: 'settings', icon: Settings, label: t('server.settings') },
  ];

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const availableUsers = allUsers.filter(u =>
    u.id !== server.owner_id &&
    !subusers.some(su => su.user_id === u.id)
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Back + header */}
      <div className="flex items-center gap-4 flex-wrap">
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
            <Play size={14} /> {t('server.start')}
          </button>
          <button
            onClick={() => powerAction('restart')}
            disabled={server.status !== 'running'}
            className="glass-btn flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <RefreshCw size={14} /> {t('server.restart')}
          </button>
          <button
            onClick={() => powerAction('stop')}
            disabled={server.status === 'stopped' || server.status === 'stopping'}
            className="glass-btn glass-btn-danger flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            <Square size={14} /> {t('server.stop')}
          </button>
          <button
            onClick={() => powerAction('kill')}
            className="glass-btn flex items-center gap-2 px-3 py-2 text-sm"
            title={t('server.kill')}
          >
            <Zap size={14} style={{ color: '#f97316' }} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Cpu, label: t('servers.cpu'), value: `${stats.cpu.toFixed(1)}%`, bar: stats.cpu / 100, color: '#f472b6' },
            { icon: MemoryStick, label: t('servers.ram'), value: `${(stats.memory / 1024).toFixed(1)} / ${(stats.memory_limit / 1024).toFixed(0)} GB`, bar: stats.memory / stats.memory_limit, color: '#a78bfa' },
            { icon: HardDrive, label: t('servers.disk'), value: `${(stats.disk / 1024).toFixed(1)} / ${(stats.disk_limit / 1024).toFixed(0)} GB`, bar: stats.disk / stats.disk_limit, color: '#38bdf8' },
            { icon: RefreshCw, label: t('server.uptime'), value: server.status === 'running' ? fmtUptime(stats.uptime) : '—', bar: 0, color: '#22c55e' },
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
        {/* Scrollable tab bar */}
        <div
          className="flex overflow-x-auto"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map(t_ => (
            <button
              key={t_.key}
              onClick={() => setTab(t_.key)}
              className="flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all relative shrink-0"
              style={{ color: tab === t_.key ? '#fff' : 'rgba(255,255,255,0.45)' }}
            >
              <t_.icon size={15} />
              <span className="whitespace-nowrap">{t_.label}</span>
              {tab === t_.key && (
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
                  {server.status === 'running' ? t('server.waitingOutput') : t('server.notRunning')}
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
                  placeholder={t('server.enterCommand')}
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
                { key: 'cpu' as const, label: `${t('servers.cpu')} (%)`, color: '#f472b6' },
                { key: 'memory' as const, label: `${t('servers.ram')} (MB)`, color: '#a78bfa' },
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
                { label: t('server.networkRx'), value: `${(stats.network_rx / 1024).toFixed(1)} KB/s` },
                { label: t('server.networkTx'), value: `${(stats.network_tx / 1024).toFixed(1)} KB/s` },
                { label: t('server.memoryLimit'), value: `${(stats.memory_limit / 1024).toFixed(1)} GB` },
                { label: t('server.diskLimit'), value: `${(stats.disk_limit / 1024).toFixed(1)} GB` },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                  <span className="font-medium text-white">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {tab === 'files' && <FileManager serverId={id!} />}

        {/* Backups */}
        {tab === 'backups' && <BackupManager serverId={id!} />}

        {/* Schedules */}
        {tab === 'schedules' && <ScheduleManager serverId={id!} />}

        {/* Databases */}
        {tab === 'databases' && <DatabaseManager serverId={id!} />}

        {/* Players */}
        {tab === 'players' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Hráči online</h3>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                {server.status === 'running' ? `${players.length} online` : 'Offline'}
              </span>
            </div>

            {server.status !== 'running' ? (
              <div className="py-12 text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Server neběží</p>
              </div>
            ) : (
              <div className="space-y-2">
                {players.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(124,58,237,0.2)' }}>
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Hraje {p.playtime}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: p.ping < 50 ? '#22c55e' : p.ping < 100 ? '#f59e0b' : '#f87171' }}>
                        {p.ping}ms
                      </span>
                      {isOwnerOrAdmin && (
                        <button
                          onClick={() => toast.success(`Hráč ${p.name} byl vyhozen`)}
                          className="glass-btn px-2.5 py-1 text-xs"
                          style={{ color: '#f87171' }}
                        >
                          Vykopnout
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: t('server.name'), value: server.name },
                { label: t('server.eggEngine'), value: server.egg_name },
                { label: t('server.node'), value: server.node_name },
                { label: t('server.owner'), value: server.owner_name },
                { label: t('servers.port'), value: String(server.port) },
                { label: t('server.created'), value: new Date(server.created_at).toLocaleDateString('cs-CZ') },
              ].map(r => (
                <div key={r.label} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.label}</div>
                  <div className="text-sm font-medium text-white">{r.value}</div>
                </div>
              ))}
            </div>
            {server.startup && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('server.startupCommand')}</div>
                <code className="text-sm" style={{ color: '#a78bfa' }}>{server.startup}</code>
              </div>
            )}
            <div className="pt-4 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setShowReinstall(true)}
                  className="glass-btn flex items-center gap-2 px-4 py-2.5 text-sm"
                  style={{ color: '#f59e0b' }}
                >
                  <RefreshCw size={15} /> {t('server.reinstall')}
                </button>
              )}
              <button className="glass-btn glass-btn-danger flex items-center gap-2 px-4 py-2.5 text-sm">
                <Trash2 size={15} /> {t('server.delete')}
              </button>
            </div>
          </div>
        )}

        {/* Permissions */}
        {tab === 'permissions' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{t('permissions.subusers')}</h3>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="glass-btn glass-btn-primary flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <Plus size={13} /> {t('permissions.addUser')}
                </button>
              )}
            </div>

            {/* Add user form */}
            {showAddUser && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('permissions.selectUser')}</label>
                  <select
                    className="glass-input w-full px-3 py-2 text-sm"
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <option value="" style={{ background: '#111' }}>{t('permissions.selectUser')}</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id} style={{ background: '#111' }}>{u.username} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Oprávnění</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(newPerms) as (keyof PermissionSet)[]).map(perm => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center cursor-pointer"
                          style={{
                            background: newPerms[perm] ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${newPerms[perm] ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          }}
                          onClick={() => setNewPerms(p => ({ ...p, [perm]: !p[perm] }))}
                        >
                          {newPerms[perm] && <Check size={10} style={{ color: '#a78bfa' }} />}
                        </div>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {t(`permissions.${perm === 'settings' ? 'settingsPerm' : perm}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSubuser}
                    disabled={!selectedUserId || addingUser}
                    className="glass-btn glass-btn-primary px-4 py-2 text-xs disabled:opacity-40"
                  >
                    {addingUser ? t('common.loading') : t('permissions.add')}
                  </button>
                  <button
                    onClick={() => setShowAddUser(false)}
                    className="glass-btn px-4 py-2 text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Subusers list */}
            {subusers.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {t('permissions.noSubusers')}
              </div>
            ) : (
              <div className="space-y-2">
                {subusers.map(su => {
                  const perms: PermissionSet = JSON.parse(su.permissions);
                  return (
                    <div
                      key={su.id}
                      className="rounded-xl p-4"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                            style={{ background: 'rgba(255,255,255,0.08)' }}
                          >
                            {su.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{su.username}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{su.email}</div>
                          </div>
                        </div>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => handleRemoveSubuser(su.user_id)}
                            className="glass-btn p-1.5"
                          >
                            <X size={13} style={{ color: '#f87171' }} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(perms) as (keyof PermissionSet)[]).map(perm => (
                          <label key={perm} className="flex items-center gap-1.5 cursor-pointer">
                            <div
                              className="w-3.5 h-3.5 rounded flex items-center justify-center"
                              style={{
                                background: perms[perm] ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${perms[perm] ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                                cursor: isOwnerOrAdmin ? 'pointer' : 'default',
                              }}
                              onClick={() => {
                                if (!isOwnerOrAdmin) return;
                                const updated = { ...perms, [perm]: !perms[perm] };
                                handleUpdatePerms(su.user_id, updated);
                              }}
                            >
                              {perms[perm] && <Check size={9} style={{ color: '#a78bfa' }} />}
                            </div>
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                              {t(`permissions.${perm === 'settings' ? 'settingsPerm' : perm}`)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reinstall confirmation modal */}
      <AnimatePresence>
        {showReinstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="liquid-card p-6 w-full max-w-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.2)' }}>
                  <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
                </div>
                <h3 className="font-semibold text-white">Přeinstalovat server?</h3>
              </div>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Tato akce přeinstaluje server. Vaše data budou zachována. Server bude po dobu instalace nedostupný.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReinstall}
                  disabled={reinstalling}
                  className="glass-btn flex-1 py-2.5 text-sm font-medium disabled:opacity-40"
                  style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                >
                  {reinstalling ? 'Přeinstalace...' : 'Přeinstalovat'}
                </button>
                <button onClick={() => setShowReinstall(false)} className="glass-btn flex-1 py-2.5 text-sm">
                  Zrušit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
