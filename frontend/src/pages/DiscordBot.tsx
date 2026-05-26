import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Play, Square, RefreshCw, Settings, Ticket, Gift, Pin,
  Shield, Zap, BarChart2, Terminal, Users, Hash, Trash2,
  Plus, Save, Eye, EyeOff, AlertTriangle, Check, ChevronDown,
  MessageSquare, Volume2, Megaphone, Award, Sword,
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotStatus { online: boolean; guilds: number; users: number; uptime: number | null }
interface BotConfig { bot_token?: string; guild_id?: string; prefix?: string; activity_type?: string; activity_text?: string; status?: string; enabled?: number }
interface GuildInfo { id: string; name: string; memberCount: number; channels: { id: string; name: string; type: number }[]; roles: { id: string; name: string; color: string }[]; iconURL?: string }
interface TicketConfig { enabled?: number; category_id?: string; log_channel_id?: string; support_role_id?: string; max_per_user?: number; welcome_message?: string; panel_title?: string; panel_description?: string; panel_color?: string }
interface WelcomeConfig { enabled?: number; channel_id?: string; message?: string; embed_enabled?: number; embed_title?: string; embed_color?: string; embed_thumbnail?: number; dm_enabled?: number; dm_message?: string; leave_enabled?: number; leave_channel_id?: string; leave_message?: string }
interface Giveaway { id: string; channel_id: string; prize: string; winners_count: number; host_username: string; entries: string; ends_at: string; ended: number; cancelled: number; created_at: string }
interface StickyMsg { id: string; channel_id: string; content: string; enabled: number; created_at: string }
interface AutoRole { id: string; role_id: string; role_name: string; enabled: number }
interface ReactionRole { id: string; channel_id: string; message_id: string; emoji: string; role_id: string; role_name: string; description: string }
interface WarnRow { id: string; user_id: string; username: string; moderator_username: string; reason: string; created_at: string }
interface ModLog { id: number; action: string; user_id: string; username: string; moderator_username: string; reason: string; duration: string; created_at: string }
interface LevelRow { user_id: string; username: string; xp: number; level: number; messages: number }
interface LevelRole { id: string; level: number; role_id: string; role_name: string }
interface CustomCmd { id: string; trigger: string; response: string; embed_enabled: number; embed_color: string; enabled: number; uses: number }
interface AutomodConfig { enabled?: number; anti_spam?: number; anti_links?: number; anti_invites?: number; bad_words?: string[]; log_channel?: string; spam_threshold?: number; spam_interval?: number }
interface LoggingConfig { enabled?: number; message_delete_channel?: string; message_edit_channel?: string; member_join_channel?: string; member_leave_channel?: string; role_change_channel?: string; voice_activity_channel?: string; ban_channel?: string }

const TABS = [
  { id: 'overview', label: 'Overview', icon: Bot },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'welcome', label: 'Welcome', icon: Megaphone },
  { id: 'giveaways', label: 'Giveaways', icon: Gift },
  { id: 'sticky', label: 'Sticky', icon: Pin },
  { id: 'autoroles', label: 'Auto-roles', icon: Users },
  { id: 'reactionroles', label: 'Reaction Roles', icon: Hash },
  { id: 'moderation', label: 'Moderation', icon: Shield },
  { id: 'logging', label: 'Logging', icon: Eye },
  { id: 'levels', label: 'Levels', icon: BarChart2 },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'automod', label: 'Automod', icon: Zap },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{children}</label>;
}

function Input({ value, onChange, placeholder = '', type = 'text', className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      onFocus={e => (e.target.style.borderColor = '#7c3aed')}
      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
    />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      onFocus={e => (e.target.style.borderColor = '#7c3aed')}
      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5.5 rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#7c3aed' : 'rgba(255,255,255,0.1)', width: 40, height: 22 }}
    >
      <span className="absolute top-0.5 rounded-full transition-all" style={{ width: 18, height: 18, background: 'white', left: checked ? 20 : 2, transition: 'left 0.2s' }} />
    </button>
  );
}

function Select({ value, onChange, options, className = '' }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0a1a' }}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'ghost' | 'success'; size?: 'sm' | 'md'; disabled?: boolean; className?: string }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,#7c3aed,#38bdf8)', color: 'white' },
    danger: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
    success: { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' },
    ghost: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' },
  };
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg font-medium transition-opacity flex items-center gap-2 ${pad} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-85'} ${className}`} style={styles[variant]}>
      {children}
    </button>
  );
}

function StatusBadge({ online }: { online: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: online ? '#4ade80' : '#f87171' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: online ? '#4ade80' : '#f87171', boxShadow: online ? '0 0 6px #4ade80' : 'none' }} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function ActionChip({ action }: { action: string }) {
  const colors: Record<string, string> = { ban: '#ef4444', kick: '#f97316', mute: '#6366f1', warn: '#f59e0b', unban: '#22c55e', unmute: '#22c55e' };
  const color = colors[action] ?? '#6b7280';
  return <span className="text-xs font-bold px-2 py-0.5 rounded uppercase" style={{ background: `${color}22`, color }}>{action}</span>;
}

function formatUptime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

// ─── Channel/Role Selectors ───────────────────────────────────────────────────

function ChannelSelect({ value, onChange, channels, placeholder }: { value: string; onChange: (v: string) => void; channels: { id: string; name: string }[]; placeholder?: string }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={[...(placeholder ? [{ value: '', label: placeholder }] : []), ...channels.map(c => ({ value: c.id, label: `#${c.name}` }))]}
    />
  );
}

function RoleSelect({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: { id: string; name: string }[] }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={roles.map(r => ({ value: r.id, label: `@${r.name}` }))}
    />
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ status, config, setConfig, guildInfo, onStart, onStop, onRefresh, starting, stopping }: {
  status: BotStatus; config: BotConfig; setConfig: (c: BotConfig) => void; guildInfo: GuildInfo | null;
  onStart: () => void; onStop: () => void; onRefresh: () => void; starting: boolean; stopping: boolean;
}) {
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/discord-bot/config', config);
      toast.success('Config saved!');
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const statCards = [
    { label: 'Status', value: <StatusBadge online={status.online} />, icon: Bot },
    { label: 'Servers', value: status.guilds, icon: Hash },
    { label: 'Users Cached', value: status.users, icon: Users },
    { label: 'Uptime', value: status.uptime ? formatUptime(status.uptime) : '—', icon: Zap },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map(s => (
          <Card key={s.label}>
            <div className="flex items-center gap-2 mb-2"><s.icon size={14} style={{ color: '#7c3aed' }} /><span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</span></div>
            <div className="text-lg font-bold text-white">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Config */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Settings size={16} /> Bot Configuration</h3>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" onClick={onRefresh}><RefreshCw size={12} /> Refresh</Btn>
              {status.online
                ? <Btn variant="danger" size="sm" onClick={onStop} disabled={stopping}><Square size={12} /> Stop</Btn>
                : <Btn size="sm" onClick={onStart} disabled={starting}><Play size={12} /> Start</Btn>
              }
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Bot Token</Label>
              <div className="relative">
                <Input value={config.bot_token ?? ''} onChange={v => setConfig({ ...config, bot_token: v })} type={showToken ? 'text' : 'password'} placeholder="Discord bot token" className="pr-10" />
                <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"><Eye size={14} className="text-white" /></button>
              </div>
            </div>
            <div>
              <Label>Guild / Server ID</Label>
              <Input value={config.guild_id ?? ''} onChange={v => setConfig({ ...config, guild_id: v })} placeholder="Your Discord server ID" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prefix</Label>
                <Input value={config.prefix ?? '!'} onChange={v => setConfig({ ...config, prefix: v })} placeholder="!" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={config.status ?? 'online'} onChange={v => setConfig({ ...config, status: v })} options={[{ value: 'online', label: '🟢 Online' }, { value: 'idle', label: '🟡 Idle' }, { value: 'dnd', label: '🔴 Do Not Disturb' }, { value: 'invisible', label: '⚫ Invisible' }]} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Activity Type</Label>
                <Select value={config.activity_type ?? 'PLAYING'} onChange={v => setConfig({ ...config, activity_type: v })} options={[{ value: 'PLAYING', label: 'Playing' }, { value: 'WATCHING', label: 'Watching' }, { value: 'LISTENING', label: 'Listening to' }, { value: 'COMPETING', label: 'Competing in' }]} />
              </div>
              <div>
                <Label>Activity Text</Label>
                <Input value={config.activity_text ?? ''} onChange={v => setConfig({ ...config, activity_text: v })} placeholder="your server" />
              </div>
            </div>
            <Btn onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Config'}</Btn>
          </div>
        </Card>

        {/* Guild info */}
        <Card>
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Hash size={16} /> Guild Info</h3>
          {guildInfo ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {guildInfo.iconURL && <img src={guildInfo.iconURL} alt="" className="w-10 h-10 rounded-full" />}
                <div>
                  <div className="font-semibold text-white">{guildInfo.name}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{guildInfo.memberCount} members</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="font-bold text-white text-lg">{guildInfo.channels.length}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)' }}>Channels</div>
                </div>
                <div className="p-2.5 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="font-bold text-white text-lg">{guildInfo.roles.length}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)' }}>Roles</div>
                </div>
              </div>
              <div>
                <Label>Text Channels</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {guildInfo.channels.filter(c => c.type === 0).slice(0, 20).map(c => (
                    <div key={c.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
                      <Hash size={10} />{c.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Bot size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Start the bot to see guild info</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TicketsTab({ config, setConfig, guildInfo, onSave }: { config: TicketConfig; setConfig: (c: TicketConfig) => void; guildInfo: GuildInfo | null; onSave: () => void }) {
  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];
  const categories = guildInfo?.channels.filter(c => c.type === 4) ?? [];
  const roles = guildInfo?.roles ?? [];
  const [tickets, setTickets] = useState<{ id: string; channel_id: string; username: string; status: string; created_at: string }[]>([]);

  useEffect(() => { api.get('/discord-bot/tickets').then(r => setTickets(r.data)).catch(() => {}); }, []);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Ticket size={16} /> Ticket System</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Enabled</span>
            <Toggle checked={!!config.enabled} onChange={v => setConfig({ ...config, enabled: v ? 1 : 0 })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Panel Title</Label>
            <Input value={config.panel_title ?? ''} onChange={v => setConfig({ ...config, panel_title: v })} placeholder="Support Tickets" />
          </div>
          <div>
            <Label>Panel Color</Label>
            <div className="flex gap-2">
              <input type="color" value={config.panel_color ?? '#7c3aed'} onChange={e => setConfig({ ...config, panel_color: e.target.value })} className="w-10 h-9 rounded cursor-pointer border-0" style={{ background: 'none' }} />
              <Input value={config.panel_color ?? '#7c3aed'} onChange={v => setConfig({ ...config, panel_color: v })} placeholder="#7c3aed" />
            </div>
          </div>
          <div className="col-span-2">
            <Label>Panel Description</Label>
            <Textarea value={config.panel_description ?? ''} onChange={v => setConfig({ ...config, panel_description: v })} placeholder="Click the button below to open a support ticket." rows={2} />
          </div>
          <div>
            <Label>Ticket Category</Label>
            <Select value={config.category_id ?? ''} onChange={v => setConfig({ ...config, category_id: v })} options={categories.map(c => ({ value: c.id, label: c.name }))} />
          </div>
          <div>
            <Label>Log Channel</Label>
            <ChannelSelect value={config.log_channel_id ?? ''} onChange={v => setConfig({ ...config, log_channel_id: v })} channels={channels} />
          </div>
          <div>
            <Label>Support Role</Label>
            <RoleSelect value={config.support_role_id ?? ''} onChange={v => setConfig({ ...config, support_role_id: v })} roles={roles} />
          </div>
          <div>
            <Label>Max Tickets per User</Label>
            <Input value={String(config.max_per_user ?? 1)} onChange={v => setConfig({ ...config, max_per_user: parseInt(v) || 1 })} type="number" placeholder="1" />
          </div>
          <div className="col-span-2">
            <Label>Welcome Message (variables: {'{user}'})</Label>
            <Textarea value={config.welcome_message ?? ''} onChange={v => setConfig({ ...config, welcome_message: v })} placeholder="Welcome {user}! Our team will assist you shortly." rows={2} />
          </div>
        </div>
        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Use <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>/ticket-setup #channel</code> to place the panel</span>
          <Btn onClick={onSave}><Save size={14} /> Save</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Ticket size={16} /> Recent Tickets</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No tickets yet</p>
        ) : (
          <div className="space-y-2">
            {tickets.slice(0, 20).map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <span className="text-sm font-medium text-white">{t.username}</span>
                  <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'open' ? '' : ''}`} style={{ background: t.status === 'open' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.2)', color: t.status === 'open' ? '#4ade80' : '#9ca3af' }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function WelcomeTab({ config, setConfig, guildInfo, onSave }: { config: WelcomeConfig; setConfig: (c: WelcomeConfig) => void; guildInfo: GuildInfo | null; onSave: () => void }) {
  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];
  const vars = ['{user}', '{username}', '{server}', '{count}', '{tag}'];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Megaphone size={16} /> Welcome Messages</h3>
          <Toggle checked={!!config.enabled} onChange={v => setConfig({ ...config, enabled: v ? 1 : 0 })} />
        </div>
        <div className="text-xs mb-4 px-3 py-2 rounded-lg flex flex-wrap gap-2" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: 'rgba(255,255,255,0.6)' }}>
          Variables: {vars.map(v => <code key={v} className="px-1 py-0.5 rounded text-purple-300" style={{ background: 'rgba(255,255,255,0.08)' }}>{v}</code>)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Welcome Channel</Label>
            <ChannelSelect value={config.channel_id ?? ''} onChange={v => setConfig({ ...config, channel_id: v })} channels={channels} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <span className="text-sm text-white">Use Embed</span>
            <Toggle checked={!!config.embed_enabled} onChange={v => setConfig({ ...config, embed_enabled: v ? 1 : 0 })} />
          </div>
          {config.embed_enabled ? (
            <>
              <div>
                <Label>Embed Title</Label>
                <Input value={config.embed_title ?? ''} onChange={v => setConfig({ ...config, embed_title: v })} placeholder="Welcome to {server}!" />
              </div>
              <div>
                <Label>Embed Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={config.embed_color ?? '#7c3aed'} onChange={e => setConfig({ ...config, embed_color: e.target.value })} className="w-10 h-9 rounded cursor-pointer border-0" />
                  <Input value={config.embed_color ?? '#7c3aed'} onChange={v => setConfig({ ...config, embed_color: v })} />
                </div>
              </div>
            </>
          ) : null}
          <div className="col-span-2">
            <Label>Welcome Message</Label>
            <Textarea value={config.message ?? ''} onChange={v => setConfig({ ...config, message: v })} placeholder="Welcome {user} to {server}!" rows={2} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg col-span-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div>
              <div className="text-sm text-white">Avatar Thumbnail</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Show user avatar in embed</div>
            </div>
            <Toggle checked={!!config.embed_thumbnail} onChange={v => setConfig({ ...config, embed_thumbnail: v ? 1 : 0 })} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><MessageSquare size={16} /> DM on Join</h3>
          <Toggle checked={!!config.dm_enabled} onChange={v => setConfig({ ...config, dm_enabled: v ? 1 : 0 })} />
        </div>
        <Label>DM Message</Label>
        <Textarea value={config.dm_message ?? ''} onChange={v => setConfig({ ...config, dm_message: v })} placeholder="Welcome to {server}!" rows={2} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><MessageSquare size={16} /> Leave Messages</h3>
          <Toggle checked={!!config.leave_enabled} onChange={v => setConfig({ ...config, leave_enabled: v ? 1 : 0 })} />
        </div>
        <div className="space-y-3">
          <div>
            <Label>Leave Channel</Label>
            <ChannelSelect value={config.leave_channel_id ?? ''} onChange={v => setConfig({ ...config, leave_channel_id: v })} channels={channels} />
          </div>
          <div>
            <Label>Leave Message</Label>
            <Textarea value={config.leave_message ?? ''} onChange={v => setConfig({ ...config, leave_message: v })} placeholder="{username} has left {server}." rows={2} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end"><Btn onClick={onSave}><Save size={14} /> Save Welcome Config</Btn></div>
    </div>
  );
}

function GiveawaysTab() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const load = () => api.get('/discord-bot/giveaways').then(r => setGiveaways(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const end = async (id: string) => {
    await api.post(`/discord-bot/giveaways/${id}/end`);
    toast.success('Giveaway ended!'); load();
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this giveaway?')) return;
    await api.delete(`/discord-bot/giveaways/${id}`);
    toast.success('Giveaway cancelled!'); load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white flex items-center gap-2"><Gift size={16} /> Giveaways</h3>
          <div className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>Use /giveaway start in Discord</div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Start giveaways directly in Discord using <code className="px-1 py-0.5 rounded text-purple-300" style={{ background: 'rgba(255,255,255,0.08)' }}>/giveaway start &lt;duration&gt; &lt;winners&gt; &lt;prize&gt;</code>
        </p>
        {giveaways.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Gift size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No giveaways yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {giveaways.map(g => {
              const entries: string[] = typeof g.entries === 'string' ? JSON.parse(g.entries) : g.entries;
              const timeLeft = new Date(g.ends_at).getTime() - Date.now();
              return (
                <div key={g.id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <Gift size={14} style={{ color: '#7c3aed' }} /> {g.prize}
                        {g.ended ? <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af' }}>Ended</span>
                          : g.cancelled ? <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Cancelled</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Active</span>}
                      </div>
                      <div className="text-xs mt-1 space-x-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span>Winners: {g.winners_count}</span>
                        <span>Entries: {entries.length}</span>
                        <span>Host: {g.host_username}</span>
                        {!g.ended && !g.cancelled && <span>Ends: {timeLeft > 0 ? `in ${Math.ceil(timeLeft / 60000)}m` : 'Ending...'}</span>}
                      </div>
                    </div>
                    {!g.ended && !g.cancelled && (
                      <div className="flex gap-2">
                        <Btn size="sm" variant="success" onClick={() => end(g.id)}><Check size={12} /> End</Btn>
                        <Btn size="sm" variant="danger" onClick={() => cancel(g.id)}><Trash2 size={12} /></Btn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StickyTab({ guildInfo }: { guildInfo: GuildInfo | null }) {
  const [stickies, setStickies] = useState<StickyMsg[]>([]);
  const [form, setForm] = useState({ channel_id: '', content: '' });
  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];

  const load = () => api.get('/discord-bot/sticky').then(r => setStickies(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.channel_id || !form.content) { toast.error('Fill in all fields'); return; }
    await api.post('/discord-bot/sticky', form);
    toast.success('Sticky message saved!'); setForm({ channel_id: '', content: '' }); load();
  };

  const toggle = async (s: StickyMsg) => {
    await api.patch(`/discord-bot/sticky/${s.id}`, { enabled: s.enabled ? 0 : 1 });
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/discord-bot/sticky/${id}`);
    toast.success('Removed!'); load();
  };

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Pin size={16} /> Add Sticky Message</h3>
        <div className="space-y-3">
          <div>
            <Label>Channel</Label>
            <ChannelSelect value={form.channel_id} onChange={v => setForm({ ...form, channel_id: v })} channels={channels} />
          </div>
          <div>
            <Label>Message Content</Label>
            <Textarea value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="Sticky message content (supports markdown)" rows={3} />
          </div>
          <Btn onClick={add}><Plus size={14} /> Add Sticky</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Pin size={16} /> Active Sticky Messages</h3>
        {stickies.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No sticky messages configured</p>
        ) : (
          <div className="space-y-2">
            {stickies.map(s => {
              const ch = channels.find(c => c.id === s.channel_id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Pin size={14} style={{ color: '#7c3aed' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">#{ch?.name ?? s.channel_id}</div>
                    <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.content}</div>
                  </div>
                  <Toggle checked={!!s.enabled} onChange={() => toggle(s)} />
                  <Btn size="sm" variant="danger" onClick={() => remove(s.id)}><Trash2 size={12} /></Btn>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function AutoRolesTab({ guildInfo }: { guildInfo: GuildInfo | null }) {
  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const roles = guildInfo?.roles ?? [];

  const load = () => api.get('/discord-bot/auto-roles').then(r => setAutoRoles(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    const role = roles.find(r => r.id === selectedRole);
    if (!role) { toast.error('Select a role'); return; }
    await api.post('/discord-bot/auto-roles', { role_id: role.id, role_name: role.name });
    toast.success('Auto-role added!'); setSelectedRole(''); load();
  };

  const toggle = async (ar: AutoRole) => {
    await api.patch(`/discord-bot/auto-roles/${ar.id}`, { enabled: ar.enabled ? 0 : 1 });
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/discord-bot/auto-roles/${id}`);
    toast.success('Removed!'); load();
  };

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Users size={16} /> Auto-assign Roles on Join</h3>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>These roles are automatically assigned when a new member joins the server.</p>
        <div className="flex gap-3">
          <div className="flex-1"><RoleSelect value={selectedRole} onChange={setSelectedRole} roles={roles} /></div>
          <Btn onClick={add}><Plus size={14} /> Add</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Users size={16} /> Configured Auto-roles</h3>
        {autoRoles.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No auto-roles configured</p>
        ) : (
          <div className="space-y-2">
            {autoRoles.map(ar => (
              <div key={ar.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: roles.find(r => r.id === ar.role_id)?.color ?? '#6b7280' }} />
                <div className="flex-1"><span className="text-sm font-medium text-white">@{ar.role_name}</span></div>
                <Toggle checked={!!ar.enabled} onChange={() => toggle(ar)} />
                <Btn size="sm" variant="danger" onClick={() => remove(ar.id)}><Trash2 size={12} /></Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReactionRolesTab({ guildInfo }: { guildInfo: GuildInfo | null }) {
  const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([]);
  const [form, setForm] = useState({ channel_id: '', message_id: '', emoji: '', role_id: '', role_name: '', description: '' });
  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];
  const roles = guildInfo?.roles ?? [];

  const load = () => api.get('/discord-bot/reaction-roles').then(r => setReactionRoles(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    const role = roles.find(r => r.id === form.role_id);
    if (!form.channel_id || !form.message_id || !form.emoji || !form.role_id) { toast.error('Fill required fields'); return; }
    await api.post('/discord-bot/reaction-roles', { ...form, role_name: role?.name ?? '' });
    toast.success('Reaction role added!'); setForm({ channel_id: '', message_id: '', emoji: '', role_id: '', role_name: '', description: '' }); load();
  };

  const remove = async (id: string) => {
    await api.delete(`/discord-bot/reaction-roles/${id}`);
    toast.success('Removed!'); load();
  };

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Hash size={16} /> Add Reaction Role</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Channel</Label>
            <ChannelSelect value={form.channel_id} onChange={v => setForm({ ...form, channel_id: v })} channels={channels} />
          </div>
          <div>
            <Label>Message ID</Label>
            <Input value={form.message_id} onChange={v => setForm({ ...form, message_id: v })} placeholder="Message ID" />
          </div>
          <div>
            <Label>Emoji</Label>
            <Input value={form.emoji} onChange={v => setForm({ ...form, emoji: v })} placeholder="🎮 or custom emoji ID" />
          </div>
          <div>
            <Label>Role</Label>
            <RoleSelect value={form.role_id} onChange={v => setForm({ ...form, role_id: v })} roles={roles} />
          </div>
          <div className="col-span-2">
            <Label>Description (optional)</Label>
            <Input value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder="What this role is for" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Get Message ID by right-clicking a message in Discord (Developer Mode)</span>
          <Btn onClick={add}><Plus size={14} /> Add</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Hash size={16} /> Reaction Roles ({reactionRoles.length})</h3>
        {reactionRoles.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No reaction roles configured</p>
        ) : (
          <div className="space-y-2">
            {reactionRoles.map(rr => {
              const ch = channels.find(c => c.id === rr.channel_id);
              return (
                <div key={rr.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-xl">{rr.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">@{rr.role_name}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>#{ch?.name ?? rr.channel_id} • {rr.description || 'No description'}</div>
                  </div>
                  <Btn size="sm" variant="danger" onClick={() => remove(rr.id)}><Trash2 size={12} /></Btn>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ModerationTab() {
  const [warns, setWarns] = useState<WarnRow[]>([]);
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [activeView, setActiveView] = useState<'warns' | 'logs'>('warns');

  useEffect(() => {
    api.get('/discord-bot/warns').then(r => setWarns(r.data)).catch(() => {});
    api.get('/discord-bot/mod-logs').then(r => setLogs(r.data)).catch(() => {});
  }, []);

  const deleteWarn = async (id: string) => {
    await api.delete(`/discord-bot/warns/${id}`);
    setWarns(p => p.filter(w => w.id !== id));
    toast.success('Warning deleted');
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Shield size={16} /> Moderation</h3>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['warns', 'logs'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)} className="px-4 py-1.5 text-sm font-medium capitalize transition-colors" style={{ background: activeView === v ? '#7c3aed' : 'transparent', color: activeView === v ? 'white' : 'rgba(255,255,255,0.5)' }}>{v}</button>
            ))}
          </div>
        </div>

        {activeView === 'warns' ? (
          warns.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>No warnings</p>
          ) : (
            <div className="space-y-2">
              {warns.map(w => (
                <div key={w.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{w.username}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>by {w.moderator_username}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{w.reason}</div>
                  </div>
                  <Btn size="sm" variant="danger" onClick={() => deleteWarn(w.id)}><Trash2 size={12} /></Btn>
                </div>
              ))}
            </div>
          )
        ) : (
          logs.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>No moderation logs</p>
          ) : (
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <ActionChip action={l.action} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{l.username}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>by {l.moderator_username}</span>
                      {l.duration && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>{l.duration}</span>}
                    </div>
                    {l.reason && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{l.reason}</div>}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Sword size={16} /> Available Slash Commands</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {['/warn <user> <reason>', '/warns [user]', '/delwarn <id>', '/ban <user>', '/unban <user_id>', '/kick <user>', '/mute <user> <duration>', '/unmute <user>', '/purge <amount>', '/role add/remove'].map(cmd => (
            <div key={cmd} className="px-3 py-2 rounded-lg font-mono" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>{cmd}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function LoggingTab({ config, setConfig, guildInfo, onSave }: { config: LoggingConfig; setConfig: (c: LoggingConfig) => void; guildInfo: GuildInfo | null; onSave: () => void }) {
  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];

  const logChannels: { key: keyof LoggingConfig; label: string; icon: React.ElementType }[] = [
    { key: 'message_delete_channel', label: 'Message Delete', icon: Trash2 },
    { key: 'message_edit_channel', label: 'Message Edit', icon: MessageSquare },
    { key: 'member_join_channel', label: 'Member Join', icon: Users },
    { key: 'member_leave_channel', label: 'Member Leave', icon: Users },
    { key: 'role_change_channel', label: 'Role Changes', icon: Award },
    { key: 'voice_activity_channel', label: 'Voice Activity', icon: Volume2 },
    { key: 'ban_channel', label: 'Bans/Unbans', icon: Shield },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Eye size={16} /> Action Logging</h3>
          <Toggle checked={!!config.enabled} onChange={v => setConfig({ ...config, enabled: v ? 1 : 0 })} />
        </div>
        <div className="space-y-3">
          {logChannels.map(lc => (
            <div key={lc.key} className="flex items-center gap-3">
              <div className="w-36 flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <lc.icon size={13} />{lc.label}
              </div>
              <div className="flex-1">
                <ChannelSelect value={(config[lc.key] as string) ?? ''} onChange={v => setConfig({ ...config, [lc.key]: v })} channels={channels} placeholder="Disabled" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end"><Btn onClick={onSave}><Save size={14} /> Save Logging</Btn></div>
      </Card>
    </div>
  );
}

function LevelsTab({ guildInfo }: { guildInfo: GuildInfo | null }) {
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [levelRoles, setLevelRoles] = useState<LevelRole[]>([]);
  const [form, setForm] = useState({ level: '', role_id: '' });
  const roles = guildInfo?.roles ?? [];

  const load = () => {
    api.get('/discord-bot/levels').then(r => setLevels(r.data)).catch(() => {});
    api.get('/discord-bot/level-roles').then(r => setLevelRoles(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const addLevelRole = async () => {
    const role = roles.find(r => r.id === form.role_id);
    if (!form.level || !form.role_id) { toast.error('Fill in all fields'); return; }
    await api.post('/discord-bot/level-roles', { level: parseInt(form.level), role_id: form.role_id, role_name: role?.name ?? '' });
    toast.success('Level role added!'); setForm({ level: '', role_id: '' }); load();
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><BarChart2 size={16} /> XP Leaderboard</h3>
        {levels.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>No XP data yet. Members earn XP by sending messages!</p>
        ) : (
          <div className="space-y-2">
            {levels.map((l, i) => (
              <div key={l.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-lg w-7 text-center">{medals[i] ?? `${i + 1}.`}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{l.username}</div>
                  <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span>Level {l.level}</span><span>{l.xp} XP</span><span>{l.messages} msgs</span>
                  </div>
                </div>
                <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (l.xp / Math.floor(100 * Math.pow(1.5, l.level))) * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#38bdf8)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Award size={16} /> Level Roles</h3>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Automatically assign roles when members reach certain levels.</p>
        <div className="flex gap-3 mb-4">
          <div className="w-28">
            <Input value={form.level} onChange={v => setForm({ ...form, level: v })} placeholder="Level" type="number" />
          </div>
          <div className="flex-1"><RoleSelect value={form.role_id} onChange={v => setForm({ ...form, role_id: v })} roles={roles} /></div>
          <Btn onClick={addLevelRole}><Plus size={14} /> Add</Btn>
        </div>
        {levelRoles.length === 0 ? (
          <p className="text-sm text-center py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>No level roles configured</p>
        ) : (
          <div className="space-y-2">
            {levelRoles.map(lr => (
              <div key={lr.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-sm font-bold" style={{ color: '#7c3aed', minWidth: 60 }}>Lvl {lr.level}</span>
                <span className="text-sm text-white flex-1">@{lr.role_name}</span>
                <Btn size="sm" variant="danger" onClick={async () => { await api.delete(`/discord-bot/level-roles/${lr.id}`); load(); }}><Trash2 size={12} /></Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CommandsTab() {
  const [commands, setCommands] = useState<CustomCmd[]>([]);
  const [form, setForm] = useState({ trigger: '', response: '', embed_enabled: false, embed_color: '#7c3aed' });

  const load = () => api.get('/discord-bot/commands').then(r => setCommands(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.trigger || !form.response) { toast.error('Trigger and response required'); return; }
    await api.post('/discord-bot/commands', { ...form, embed_enabled: form.embed_enabled ? 1 : 0 });
    toast.success('Command added!'); setForm({ trigger: '', response: '', embed_enabled: false, embed_color: '#7c3aed' }); load();
  };

  const toggleCmd = async (cmd: CustomCmd) => {
    await api.patch(`/discord-bot/commands/${cmd.id}`, { enabled: cmd.enabled ? 0 : 1 });
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/discord-bot/commands/${id}`);
    toast.success('Deleted!'); load();
  };

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Terminal size={16} /> Add Custom Command</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Trigger (without prefix)</Label>
            <Input value={form.trigger} onChange={v => setForm({ ...form, trigger: v })} placeholder="help, rules, info..." />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <Label>Embed</Label>
              <Toggle checked={form.embed_enabled} onChange={v => setForm({ ...form, embed_enabled: v })} />
            </div>
            {form.embed_enabled && (
              <div className="flex-1">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.embed_color} onChange={e => setForm({ ...form, embed_color: e.target.value })} className="w-10 h-9 rounded cursor-pointer border-0" />
                  <Input value={form.embed_color} onChange={v => setForm({ ...form, embed_color: v })} />
                </div>
              </div>
            )}
          </div>
          <div className="col-span-2">
            <Label>Response</Label>
            <Textarea value={form.response} onChange={v => setForm({ ...form, response: v })} placeholder="Command response (markdown supported)" rows={3} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Members use: <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>!trigger</code> (prefix from config)</span>
          <Btn onClick={add}><Plus size={14} /> Add Command</Btn>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><Terminal size={16} /> Custom Commands ({commands.length})</h3>
        {commands.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>No custom commands yet</p>
        ) : (
          <div className="space-y-2">
            {commands.map(cmd => (
              <div key={cmd.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <code className="text-sm font-mono px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>!{cmd.trigger}</code>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{cmd.response}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Used {cmd.uses}×{cmd.embed_enabled ? ' • embed' : ''}</div>
                </div>
                <Toggle checked={!!cmd.enabled} onChange={() => toggleCmd(cmd)} />
                <Btn size="sm" variant="danger" onClick={() => remove(cmd.id)}><Trash2 size={12} /></Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AutomodTab() {
  const [config, setConfig] = useState<AutomodConfig>({});
  const [newWord, setNewWord] = useState('');
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/discord-bot/automod').then(r => setConfig(r.data)).catch(() => {});
    api.get('/discord-bot/guild-info').then(r => setGuildInfo(r.data)).catch(() => {});
  }, []);

  const channels = guildInfo?.channels.filter(c => c.type === 0) ?? [];

  const save = async () => {
    setSaving(true);
    try { await api.patch('/discord-bot/automod', config); toast.success('Saved!'); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    const words = config.bad_words ?? [];
    if (!words.includes(newWord.trim().toLowerCase())) {
      setConfig({ ...config, bad_words: [...words, newWord.trim().toLowerCase()] });
    }
    setNewWord('');
  };

  const removeWord = (w: string) => setConfig({ ...config, bad_words: (config.bad_words ?? []).filter(bw => bw !== w) });

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Zap size={16} /> Auto-moderation</h3>
          <Toggle checked={!!config.enabled} onChange={v => setConfig({ ...config, enabled: v ? 1 : 0 })} />
        </div>
        <div className="space-y-3">
          {[
            { key: 'anti_links' as const, label: 'Block Links', desc: 'Remove messages containing URLs (except mods)' },
            { key: 'anti_invites' as const, label: 'Block Discord Invites', desc: 'Remove discord.gg invite links' },
            { key: 'anti_spam' as const, label: 'Anti-Spam', desc: 'Remove messages when users send too fast' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.desc}</div>
              </div>
              <Toggle checked={!!config[item.key]} onChange={v => setConfig({ ...config, [item.key]: v ? 1 : 0 })} />
            </div>
          ))}
          {config.anti_spam ? (
            <div className="grid grid-cols-2 gap-3 pl-3">
              <div>
                <Label>Messages threshold</Label>
                <Input value={String(config.spam_threshold ?? 5)} onChange={v => setConfig({ ...config, spam_threshold: parseInt(v) || 5 })} type="number" placeholder="5" />
              </div>
              <div>
                <Label>Within (seconds)</Label>
                <Input value={String(config.spam_interval ?? 5)} onChange={v => setConfig({ ...config, spam_interval: parseInt(v) || 5 })} type="number" placeholder="5" />
              </div>
            </div>
          ) : null}
          <div>
            <Label>Log Channel</Label>
            <ChannelSelect value={config.log_channel ?? ''} onChange={v => setConfig({ ...config, log_channel: v })} channels={channels} placeholder="No logging" />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-3"><AlertTriangle size={16} /> Bad Words Filter</h3>
        <div className="flex gap-2 mb-3">
          <Input value={newWord} onChange={setNewWord} placeholder="Add word..." />
          <Btn onClick={addWord}><Plus size={14} /></Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          {(config.bad_words ?? []).map(w => (
            <span key={w} className="flex items-center gap-1.5 px-2 py-1 rounded text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {w}
              <button onClick={() => removeWord(w)} className="hover:opacity-70"><Trash2 size={10} /></button>
            </span>
          ))}
          {!(config.bad_words ?? []).length && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No words filtered</span>}
        </div>
      </Card>

      <div className="flex justify-end"><Btn onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Automod'}</Btn></div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiscordBot() {
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState<BotStatus>({ online: false, guilds: 0, users: 0, uptime: null });
  const [config, setConfig] = useState<BotConfig>({});
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>({});
  const [welcomeConfig, setWelcomeConfig] = useState<WelcomeConfig>({});
  const [loggingConfig, setLoggingConfig] = useState<LoggingConfig>({});
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const [s, c, g, tc, wc, lc] = await Promise.all([
        api.get('/discord-bot/status'),
        api.get('/discord-bot/config'),
        api.get('/discord-bot/guild-info'),
        api.get('/discord-bot/ticket-config'),
        api.get('/discord-bot/welcome'),
        api.get('/discord-bot/logging'),
      ]);
      setStatus(s.data);
      setConfig(c.data);
      setGuildInfo(g.data);
      setTicketConfig(tc.data);
      setWelcomeConfig(wc.data);
      setLoggingConfig(lc.data);
    } catch {}
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(() => { api.get('/discord-bot/status').then(r => setStatus(r.data)).catch(() => {}); }, 10000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const startBot = async () => {
    setStarting(true);
    try {
      const r = await api.post('/discord-bot/start');
      if (r.data.success) { toast.success('Bot started!'); setTimeout(refreshStatus, 2000); }
      else toast.error(r.data.error ?? 'Failed to start bot');
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'); }
    finally { setStarting(false); }
  };

  const stopBot = async () => {
    setStopping(true);
    try {
      await api.post('/discord-bot/stop');
      toast.success('Bot stopped'); await refreshStatus();
    } finally { setStopping(false); }
  };

  const saveTicketConfig = async () => {
    await api.patch('/discord-bot/ticket-config', ticketConfig);
    toast.success('Ticket config saved!');
  };

  const saveWelcomeConfig = async () => {
    await api.patch('/discord-bot/welcome', welcomeConfig);
    toast.success('Welcome config saved!');
  };

  const saveLoggingConfig = async () => {
    await api.patch('/discord-bot/logging', loggingConfig);
    toast.success('Logging config saved!');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab status={status} config={config} setConfig={setConfig} guildInfo={guildInfo} onStart={startBot} onStop={stopBot} onRefresh={refreshStatus} starting={starting} stopping={stopping} />;
      case 'tickets': return <TicketsTab config={ticketConfig} setConfig={setTicketConfig} guildInfo={guildInfo} onSave={saveTicketConfig} />;
      case 'welcome': return <WelcomeTab config={welcomeConfig} setConfig={setWelcomeConfig} guildInfo={guildInfo} onSave={saveWelcomeConfig} />;
      case 'giveaways': return <GiveawaysTab />;
      case 'sticky': return <StickyTab guildInfo={guildInfo} />;
      case 'autoroles': return <AutoRolesTab guildInfo={guildInfo} />;
      case 'reactionroles': return <ReactionRolesTab guildInfo={guildInfo} />;
      case 'moderation': return <ModerationTab />;
      case 'logging': return <LoggingTab config={loggingConfig} setConfig={setLoggingConfig} guildInfo={guildInfo} onSave={saveLoggingConfig} />;
      case 'levels': return <LevelsTab guildInfo={guildInfo} />;
      case 'commands': return <CommandsTab />;
      case 'automod': return <AutomodTab />;
      default: return null;
    }
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#5865F2,#7c3aed)' }}>
              <Bot size={18} className="text-white" />
            </div>
            Discord Bot Manager
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Full-featured Discord bot — tickets, giveaways, moderation, welcome messages and more
          </p>
        </div>
        <StatusBadge online={status.online} />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0"
            style={{
              background: activeTab === tab.id ? 'rgba(124,58,237,0.2)' : 'transparent',
              color: activeTab === tab.id ? '#c4b5fd' : 'rgba(255,255,255,0.45)',
              border: activeTab === tab.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {renderTab()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

