import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { fireWebhook } from '../services/discord';

const router = Router();

router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === 'admin';
  const isHelper = req.user!.role === 'helper';

  let servers: any[];
  if (isAdmin || isHelper) {
    servers = db.prepare(`
      SELECT s.*, u.username as owner_name, n.name as node_name, e.name as egg_name, e.icon, e.color
      FROM servers s
      JOIN users u ON s.owner_id = u.id
      JOIN nodes n ON s.node_id = n.id
      JOIN eggs e ON s.egg_id = e.id
      ORDER BY s.created_at DESC
    `).all();
  } else {
    // Own servers + servers where user is a sub-user
    servers = db.prepare(`
      SELECT DISTINCT s.*, u.username as owner_name, n.name as node_name, e.name as egg_name, e.icon, e.color
      FROM servers s
      JOIN users u ON s.owner_id = u.id
      JOIN nodes n ON s.node_id = n.id
      JOIN eggs e ON s.egg_id = e.id
      LEFT JOIN server_subusers ss ON s.id = ss.server_id AND ss.user_id = ?
      WHERE s.owner_id = ? OR ss.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user!.id, req.user!.id, req.user!.id);
  }

  res.json(servers);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const server = db.prepare(`
    SELECT s.*, u.username as owner_name, n.name as node_name, e.name as egg_name, e.icon, e.color, e.startup, e.variables
    FROM servers s
    JOIN users u ON s.owner_id = u.id
    JOIN nodes n ON s.node_id = n.id
    JOIN eggs e ON s.egg_id = e.id
    WHERE s.id = ?
  `).get(req.params.id) as any;

  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isAdmin = req.user!.role === 'admin';
  const isHelper = req.user!.role === 'helper';
  const isOwner = server.owner_id === req.user!.id;
  const isSubuser = !!db.prepare('SELECT id FROM server_subusers WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user!.id);

  if (!isAdmin && !isHelper && !isOwner && !isSubuser) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(server);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, description, node_id, egg_id, memory, disk, cpu, port, environment } = req.body;
  if (!name || !node_id || !egg_id) return res.status(400).json({ error: 'name, node_id, egg_id required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO servers (id, name, description, owner_id, node_id, egg_id, memory, disk, cpu, port, environment, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installing')
  `).run(id, name, description || '', req.user!.id, node_id, egg_id, memory || 1024, disk || 10240, cpu || 100, port || 25565, JSON.stringify(environment || {}));

  setTimeout(() => {
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(id);
    fireWebhook('server.install', { Server: name, Status: 'Instalace dokončena' });
  }, 3000);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  res.status(201).json(server);
});

router.patch('/:id/power', (req: AuthRequest, res: Response) => {
  const { action } = req.body;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isAdmin = req.user!.role === 'admin';
  const isOwner = server.owner_id === req.user!.id;
  const subuser = db.prepare('SELECT permissions FROM server_subusers WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  const hasPowerPerm = subuser && JSON.parse(subuser.permissions).power;

  if (!isAdmin && !isOwner && !hasPowerPerm) return res.status(403).json({ error: 'Forbidden' });

  const transitions: Record<string, { interim: string; final: string }> = {
    start: { interim: 'starting', final: 'running' },
    stop: { interim: 'stopping', final: 'stopped' },
    restart: { interim: 'starting', final: 'running' },
    kill: { interim: 'stopping', final: 'stopped' }
  };

  const t = transitions[action];
  if (!t) return res.status(400).json({ error: 'Invalid action' });

  db.prepare("UPDATE servers SET status = ? WHERE id = ?").run(t.interim, req.params.id);
  setTimeout(() => {
    db.prepare("UPDATE servers SET status = ? WHERE id = ?").run(t.final, req.params.id);
    if (t.final === 'running') {
      fireWebhook('server.start', { Server: server.name, Akce: action });
    } else if (t.final === 'stopped') {
      fireWebhook('server.stop', { Server: server.name, Akce: action });
    }
  }, action === 'restart' ? 4000 : 2000);

  res.json({ status: t.interim });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'admin' && server.owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const { name, description, memory, disk, cpu } = req.body;
  db.prepare('UPDATE servers SET name=COALESCE(?,name), description=COALESCE(?,description), memory=COALESCE(?,memory), disk=COALESCE(?,disk), cpu=COALESCE(?,cpu) WHERE id=?')
    .run(name, description, memory, disk, cpu, req.params.id);

  res.json(db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  db.prepare('DELETE FROM server_logs WHERE server_id = ?').run(req.params.id);
  db.prepare('DELETE FROM server_subusers WHERE server_id = ?').run(req.params.id);
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/stats', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isRunning = server.status === 'running';
  res.json({
    cpu: isRunning ? Math.random() * 60 + 10 : 0,
    memory: isRunning ? Math.random() * (server.memory * 0.7) + server.memory * 0.1 : 0,
    memory_limit: server.memory,
    disk: Math.random() * (server.disk * 0.4) + server.disk * 0.05,
    disk_limit: server.disk,
    network_rx: isRunning ? Math.random() * 1024 * 100 : 0,
    network_tx: isRunning ? Math.random() * 1024 * 50 : 0,
    uptime: isRunning ? Math.floor(Math.random() * 86400) : 0
  });
});

router.get('/:id/logs', (req: AuthRequest, res: Response) => {
  const logs = db.prepare('SELECT * FROM server_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 100').all(req.params.id);
  res.json(logs.reverse());
});

export default router;
