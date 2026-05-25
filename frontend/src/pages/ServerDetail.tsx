import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Square, RefreshCw, Zap, MemoryStick, HardDrive, Cpu, Send, Terminal, BarChart3, Settings, Trash2, Shield, Plus, X, Check } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import api from '../api/client';
import { Server, ServerStats, SubUser, User } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';
import { useI18n } from '../hooks/useI18n';
import { useAuthStore } from '../store/auth';

type Tab = 'console' | 'stats' | 'settings' | 'permissions';

interface ConsoleEntry { line: string; type: string; }

interface PermissionSet {
  console: boolean;
  power: boolean;
  files: boolean;
  settings: boolean;
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
      if (currentUser?.role === 'admin') {
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
    await api.patch(`/servers/${id}/power`, { action });
    setTimeout(fetchServer, 500);
  };

  const handleAddSubuser = async () => {
    if (!selectedUserId) return;
    setAddingUser(true);
    try {
      await api.post(`/servers/${id}/subusers`, { user_id: selectedUserId, permissions: newPerms });
      fetchSubusers();
      setShowAddUser(false);
      setSelectedUserId('');
      setNewPerms({ console: true, power: true, files: false, settings: false });
    } catch {
      // ignore
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveSubuser = async (userId: string) => {
    if (!confirm('Odebrat tohoto uživatele?')) return;
    await api.delete(`/servers/${id}/subusers/${userId}`);
    fetchSubusers();
  };

  const handleUpdatePerms = async (userId: string, perms: PermissionSet) => {
    await api.patch(`/servers/${id}/subusers/${userId}`, { permissions: perms });
    fetchSubusers();
  };

  if (!server) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const isOwnerOrAdmin = currentUser?.role === 'admin' || server.owner_id === currentUser?.id;

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: 'console', icon: Terminal, label: t('server.console') },
    { key: 'stats', icon: BarChart3, label: t('server.stats') },
    { key: 'settings', icon: Settings, label: t('server.settings') },
    { key: 'permissions', icon: Shield, label: t('server.permissions') },
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
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {tabs.map(t_ => (
            <button
              key={t_.key}
              onClick={() => setTab(t_.key)}
              className="flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all relative"
              style={{ color: tab === t_.key ? '#fff' : 'rgba(255,255,255,0.45)' }}
            >
              <t_.icon size={15} />
              {t_.label}
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
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
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
    </div>
  );
}
