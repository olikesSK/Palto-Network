import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { initDatabase, db } from './db/database';
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import eggRoutes from './routes/eggs';
import nodeRoutes from './routes/nodes';
import userRoutes from './routes/users';
import webhookRoutes from './routes/webhooks';
import permissionRoutes from './routes/permissions';
import filesRoutes from './routes/files';
import backupsRoutes from './routes/backups';
import schedulesRoutes from './routes/schedules';
import twofaRoutes from './routes/twofa';
import apikeysRoutes from './routes/apikeys';
import databasesRoutes from './routes/databases';
import auditRoutes from './routes/audit';
import announcementsRoutes from './routes/announcements';
import settingsRoutes from './routes/settings';
import discordBotRoutes from './routes/discord-bot';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth';
import * as processManager from './services/process';
import { restoreSchedules } from './routes/schedules';
import { discordBot } from './services/discordBot';

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });

app.use('/api/auth/login', authLimiter);
app.use('/api', apiLimiter);

initDatabase();

// Create server_stats table if not present
try {
  db.exec(`CREATE TABLE IF NOT EXISTS server_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    cpu REAL NOT NULL DEFAULT 0,
    memory REAL NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_server_stats_server_id ON server_stats (server_id)`);
} catch { /* ignore */ }

// Wire process manager console output to Socket.io
processManager.setIoEmitter((serverId, line, type) => {
  io.to(`console:${serverId}`).emit('console:output', { serverId, line, type });
});

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/servers/:id/subusers', permissionRoutes);
app.use('/api/eggs', eggRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use('/api/servers', filesRoutes);
app.use('/api/servers', backupsRoutes);
app.use('/api/servers', schedulesRoutes);
app.use('/api/servers', databasesRoutes);
app.use('/api/auth', twofaRoutes);
app.use('/api/apikeys', apikeysRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/discord-bot', discordBotRoutes);

app.get('/api/stats', (_req, res) => {
  const totalServers = (db.prepare('SELECT COUNT(*) as c FROM servers').get() as { c: number }).c;
  const runningServers = (db.prepare("SELECT COUNT(*) as c FROM servers WHERE status = 'running'").get() as { c: number }).c;
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const totalNodes = (db.prepare('SELECT COUNT(*) as c FROM nodes').get() as { c: number }).c;
  const onlineNodes = (db.prepare("SELECT COUNT(*) as c FROM nodes WHERE status = 'online'").get() as { c: number }).c;
  const allocatedMemory = (db.prepare('SELECT COALESCE(SUM(memory),0) as v FROM servers').get() as { v: number }).v;
  const allocatedDisk = (db.prepare('SELECT COALESCE(SUM(disk),0) as v FROM servers').get() as { v: number }).v;
  const totalMemory = (db.prepare('SELECT COALESCE(SUM(memory),0) as v FROM nodes').get() as { v: number }).v;
  const totalDisk = (db.prepare('SELECT COALESCE(SUM(disk),0) as v FROM nodes').get() as { v: number }).v;

  res.json({ totalServers, runningServers, totalUsers, totalNodes, onlineNodes, allocatedMemory, allocatedDisk, totalMemory, totalDisk });
});

app.get('/api/stats/history', (req, res) => {
  const VALID_PERIODS: Record<string, number> = { '1h': 60, '6h': 360, '24h': 1440 };
  const minutes = VALID_PERIODS[(req.query.period as string)] ?? 60;
  try {
    const rows = db.prepare(
      `SELECT strftime('%H:%M', timestamp) as time,
              ROUND(AVG(cpu), 1) as cpu,
              ROUND(AVG(memory), 1) as memory,
              COUNT(DISTINCT server_id) as active_servers
       FROM server_stats
       WHERE timestamp >= datetime('now', ? || ' minutes')
       GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
       ORDER BY time ASC LIMIT 120`
    ).all(`-${minutes}`) as { time: string; cpu: number; memory: number; active_servers: number }[];
    res.json(rows);
  } catch { res.json([]); }
});

app.get('/api/activity', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

app.get('/api/status', (_req, res) => {
  const nodes = db.prepare("SELECT id, name, fqdn, status FROM nodes").all() as { id: string; name: string; fqdn: string; status: string }[];
  const servers = db.prepare("SELECT id, name, status, node_id FROM servers").all() as { id: string; name: string; status: string; node_id: string }[];
  const totalServers = servers.length;
  const runningServers = servers.filter(s => s.status === 'running').length;
  const onlineNodes = nodes.filter(n => n.status === 'online').length;

  res.json({
    panel: 'Palto-Network',
    status: onlineNodes === nodes.length ? 'operational' : onlineNodes > 0 ? 'degraded' : 'outage',
    nodes: nodes.map(n => ({
      ...n,
      servers: servers.filter(s => s.node_id === n.id).length,
      running: servers.filter(s => s.node_id === n.id && s.status === 'running').length,
    })),
    stats: { totalServers, runningServers, totalNodes: nodes.length, onlineNodes },
    updated: new Date().toISOString(),
  });
});

// 404 handler for unmatched API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const onlineUsers = new Map<string, { id: string; username: string; role: string; socketId: string }>();

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  let user: { id: string; username: string; role: string } | null = null;

  try {
    user = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };
  } catch {
    socket.disconnect();
    return;
  }

  onlineUsers.set(socket.id, { id: user.id, username: user.username, role: user.role, socketId: socket.id });
  io.emit('chat:online', Array.from(onlineUsers.values()));

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('chat:online', Array.from(onlineUsers.values()));
  });

  // Chat events — channel is whitelisted to prevent info leakage
  const ALLOWED_CHANNELS = new Set(['global', 'admin', 'support', 'announcements']);

  socket.on('chat:join', (channel: unknown) => {
    if (typeof channel !== 'string' || !ALLOWED_CHANNELS.has(channel)) return;
    if (channel === 'admin' && user!.role !== 'admin' && user!.role !== 'helper') return;
    socket.join(`chat:${channel}`);
    const messages = db.prepare('SELECT * FROM chat_messages WHERE channel = ? ORDER BY created_at DESC LIMIT 50').all(channel);
    socket.emit('chat:history', { channel, messages: (messages as { created_at: string }[]).reverse() });
  });

  socket.on('chat:message', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const { channel, message } = data as { channel: unknown; message: unknown };
    if (typeof channel !== 'string' || !ALLOWED_CHANNELS.has(channel)) return;
    if (channel === 'admin' && user!.role !== 'admin' && user!.role !== 'helper') return;
    if (typeof message !== 'string' || !message.trim() || message.length > 500) return;
    const clean = message.trim();
    db.prepare('INSERT INTO chat_messages (user_id, username, role, channel, message) VALUES (?, ?, ?, ?, ?)').run(
      user!.id, user!.username, user!.role, channel, clean
    );
    const msg = {
      user_id: user!.id, username: user!.username, role: user!.role,
      channel, message: clean, created_at: new Date().toISOString()
    };
    io.to(`chat:${channel}`).emit('chat:message', msg);
  });

  // Console events
  socket.on('console:attach', (serverId: string) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string; status: string } | undefined;
    if (!server) return;
    if (user!.role !== 'admin' && user!.role !== 'helper' && server.owner_id !== user!.id) {
      const isSubuser = db.prepare('SELECT id FROM server_subusers WHERE server_id = ? AND user_id = ?').get(serverId, user!.id);
      if (!isSubuser) return;
    }

    socket.join(`console:${serverId}`);

    // Send recent log history
    const logs = db.prepare('SELECT * FROM server_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 100').all(serverId);
    (logs as { message: string; type: string }[]).reverse().forEach((log) => {
      socket.emit('console:output', { serverId, line: log.message, type: log.type });
    });
  });

  socket.on('console:detach', (serverId: string) => {
    socket.leave(`console:${serverId}`);
  });

  socket.on('console:command', (data: { serverId: string; command: string }) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(data.serverId) as { status: string; owner_id: string } | undefined;
    if (!server || server.status !== 'running') return;

    // Check permissions
    if (user!.role !== 'admin' && user!.role !== 'helper' && server.owner_id !== user!.id) {
      const sub = db.prepare('SELECT permissions FROM server_subusers WHERE server_id = ? AND user_id = ?').get(data.serverId, user!.id) as { permissions: string } | undefined;
      if (!sub || !JSON.parse(sub.permissions).console) return;
    }

    const line = `> ${data.command}`;
    io.to(`console:${data.serverId}`).emit('console:output', { serverId: data.serverId, line, type: 'command' });
    db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(data.serverId, line, 'command');

    // Send to real process stdin
    const sent = processManager.sendCommand(data.serverId, data.command);
    if (!sent) {
      const errLine = '[Console] Server process is not running';
      io.to(`console:${data.serverId}`).emit('console:output', { serverId: data.serverId, line: errLine, type: 'error' });
    }
  });

  socket.on('announcement:create', (announcement: unknown) => {
    if (user!.role === 'admin') {
      io.emit('announcement:new', announcement);
    }
  });
});

export { io };

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Palto-Network backend running on port ${PORT}`);
  // Restore scheduled tasks from DB
  restoreSchedules();

  // Auto-start Discord bot if enabled
  const botConfig = db.prepare('SELECT enabled FROM discord_bot_config WHERE id = ?').get('main') as { enabled: number } | undefined;
  if (botConfig?.enabled) {
    discordBot.start().then(r => {
      if (!r.success) console.warn('[Discord Bot] Auto-start failed:', r.error);
    });
  }
});
