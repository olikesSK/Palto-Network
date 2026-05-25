import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initDatabase, db } from './db/database';
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import eggRoutes from './routes/eggs';
import nodeRoutes from './routes/nodes';
import userRoutes from './routes/users';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth';

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/eggs', eggRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/users', userRoutes);

app.get('/api/stats', (_req, res) => {
  const totalServers = (db.prepare('SELECT COUNT(*) as c FROM servers').get() as any).c;
  const runningServers = (db.prepare("SELECT COUNT(*) as c FROM servers WHERE status = 'running'").get() as any).c;
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const totalNodes = (db.prepare('SELECT COUNT(*) as c FROM nodes').get() as any).c;
  const onlineNodes = (db.prepare("SELECT COUNT(*) as c FROM nodes WHERE status = 'online'").get() as any).c;

  res.json({ totalServers, runningServers, totalUsers, totalNodes, onlineNodes });
});

const consoleSessions = new Map<string, NodeJS.Timeout>();

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  let user: any = null;

  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    socket.disconnect();
    return;
  }

  socket.on('console:attach', (serverId: string) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as any;
    if (!server) return;
    if (user.role !== 'admin' && server.owner_id !== user.id) return;

    socket.join(`console:${serverId}`);

    const logs = db.prepare('SELECT * FROM server_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 50').all(serverId);
    logs.reverse().forEach((log: any) => {
      socket.emit('console:output', { serverId, line: log.message, type: log.type });
    });

    if (server.status === 'running') {
      const interval = setInterval(() => {
        const lines = [
          `[${new Date().toTimeString().slice(0, 8)}] [Server thread/INFO]: ${['Tick processing', 'Saving chunks', 'Player activity', 'Memory GC', 'World tick'][Math.floor(Math.random() * 5)]}`,
          `[${new Date().toTimeString().slice(0, 8)}] [Server thread/INFO]: Server is running at ${Math.floor(Math.random() * 5) + 18} TPS`,
        ];
        const line = lines[Math.floor(Math.random() * lines.length)];
        io.to(`console:${serverId}`).emit('console:output', { serverId, line, type: 'output' });
        db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(serverId, line, 'output');
      }, 3000 + Math.random() * 4000);

      consoleSessions.set(socket.id + serverId, interval);
      socket.on('disconnect', () => clearInterval(interval));
      socket.on('console:detach', () => clearInterval(interval));
    }
  });

  socket.on('console:command', (data: { serverId: string; command: string }) => {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(data.serverId) as any;
    if (!server || server.status !== 'running') return;

    const line = `> ${data.command}`;
    io.to(`console:${data.serverId}`).emit('console:output', { serverId: data.serverId, line, type: 'command' });
    db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(data.serverId, line, 'command');

    setTimeout(() => {
      const response = `[${new Date().toTimeString().slice(0, 8)}] [Server thread/INFO]: Command executed: ${data.command}`;
      io.to(`console:${data.serverId}`).emit('console:output', { serverId: data.serverId, line: response, type: 'output' });
      db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(data.serverId, response, 'output');
    }, 300);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Wizz-Craft backend running on port ${PORT}`);
});
