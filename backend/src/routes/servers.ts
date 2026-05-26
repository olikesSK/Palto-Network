import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { fireWebhook } from '../services/discord';
import * as processManager from '../services/process';
import { pullServerImage } from '../services/process';

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
  if (typeof name === 'string' && (name.trim().length < 1 || name.length > 64)) return res.status(400).json({ error: 'Server name must be 1–64 characters' });

  // Validate resource bounds
  const mem = Math.max(128, Math.min(131072, parseInt(memory) || 1024));
  const dsk = Math.max(512, Math.min(2097152, parseInt(disk) || 10240));
  const cpuPct = Math.max(10, Math.min(3200, parseInt(cpu) || 100));
  const portNum = parseInt(port) || 25565;
  if (portNum < 1024 || portNum > 65535) return res.status(400).json({ error: 'Port must be between 1024 and 65535' });

  const node = db.prepare('SELECT memory, disk FROM nodes WHERE id = ?').get(node_id) as { memory: number; disk: number } | undefined;
  if (!node) return res.status(404).json({ error: 'Node not found' });
  if (mem > node.memory) return res.status(400).json({ error: `Memory exceeds node limit (${node.memory} MB)` });
  if (dsk > node.disk) return res.status(400).json({ error: `Disk exceeds node limit (${node.disk} MB)` });

  const egg = db.prepare('SELECT name FROM eggs WHERE id = ?').get(egg_id) as { name: string } | undefined;
  if (!egg) return res.status(404).json({ error: 'Egg not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO servers (id, name, description, owner_id, node_id, egg_id, memory, disk, cpu, port, environment, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installing')
  `).run(id, name.trim(), description || '', req.user!.id, node_id, egg_id, mem, dsk, cpuPct, portNum, JSON.stringify(environment || {}));

  // Pull Docker image in background, then mark stopped
  pullServerImage(egg.name, id).then(() => {
    fireWebhook('server.install', { Server: name, Status: 'Installation complete' });
  });

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  res.status(201).json(server);
});

router.patch('/:id/power', async (req: AuthRequest, res: Response) => {
  const { action } = req.body;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isAdmin = req.user!.role === 'admin';
  const isOwner = server.owner_id === req.user!.id;
  const subuser = db.prepare('SELECT permissions FROM server_subusers WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  const hasPowerPerm = subuser && JSON.parse(subuser.permissions).power;

  if (!isAdmin && !isOwner && !hasPowerPerm) return res.status(403).json({ error: 'Forbidden' });

  switch (action) {
    case 'start': {
      if (processManager.isRunning(req.params.id)) {
        return res.status(409).json({ error: 'Server is already running' });
      }
      db.prepare("UPDATE servers SET status = 'starting' WHERE id = ?").run(req.params.id);
      const started = processManager.startServer(req.params.id);
      if (!started) {
        db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(req.params.id);
        return res.status(500).json({ error: 'Failed to start server process' });
      }
      fireWebhook('server.start', { Server: server.name, Akce: action });
      return res.json({ status: 'starting' });
    }

    case 'stop': {
      if (!processManager.isRunning(req.params.id)) {
        db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(req.params.id);
        return res.json({ status: 'stopped' });
      }
      processManager.stopServer(req.params.id, false);
      fireWebhook('server.stop', { Server: server.name, Akce: action });
      return res.json({ status: 'stopping' });
    }

    case 'kill': {
      processManager.stopServer(req.params.id, true);
      fireWebhook('server.stop', { Server: server.name, Akce: 'kill' });
      return res.json({ status: 'stopping' });
    }

    case 'restart': {
      db.prepare("UPDATE servers SET status = 'starting' WHERE id = ?").run(req.params.id);
      if (processManager.isRunning(req.params.id)) {
        processManager.stopServer(req.params.id, false);
        // Wait for process to exit then restart
        const wait = () => {
          if (!processManager.isRunning(req.params.id)) {
            processManager.startServer(req.params.id);
          } else {
            setTimeout(wait, 500);
          }
        };
        setTimeout(wait, 2000);
      } else {
        processManager.startServer(req.params.id);
      }
      return res.json({ status: 'starting' });
    }

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
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

  // Kill the process if running
  if (processManager.isRunning(req.params.id)) {
    processManager.stopServer(req.params.id, true);
  }

  db.prepare('DELETE FROM server_logs WHERE server_id = ?').run(req.params.id);
  db.prepare('DELETE FROM server_subusers WHERE server_id = ?').run(req.params.id);
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isRunning = processManager.isRunning(req.params.id);

  if (isRunning) {
    const procStats = await processManager.getStats(req.params.id);
    if (procStats) {
      // Record to server_stats table for historical charts
      try {
        db.prepare('INSERT INTO server_stats (server_id, cpu, memory, timestamp) VALUES (?, ?, ?, datetime("now"))').run(
          req.params.id, procStats.cpu, Math.round(procStats.memory / 1024 / 1024)
        );
      } catch { /* table may not exist yet */ }

      return res.json({
        cpu: procStats.cpu,
        memory: Math.round(procStats.memory / 1024 / 1024),
        memory_limit: server.memory,
        disk: 0,
        disk_limit: server.disk,
        network_rx: 0,
        network_tx: 0,
        uptime: procStats.uptime,
      });
    }
  }

  res.json({
    cpu: 0,
    memory: 0,
    memory_limit: server.memory,
    disk: 0,
    disk_limit: server.disk,
    network_rx: 0,
    network_tx: 0,
    uptime: 0,
  });
});

router.get('/:id/stats/history', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const VALID_PERIODS: Record<string, number> = { '1h': 60, '6h': 360, '24h': 1440 };
  const rawPeriod = (req.query.period as string) || '1h';
  const minutes = VALID_PERIODS[rawPeriod] ?? 60;

  try {
    const rows = db.prepare(
      `SELECT cpu, memory, timestamp FROM server_stats
       WHERE server_id = ? AND timestamp >= datetime('now', ? || ' minutes')
       ORDER BY timestamp ASC LIMIT 500`
    ).all(req.params.id, `-${minutes}`);
    return res.json(rows);
  } catch {
    return res.json([]);
  }
});

router.get('/:id/logs', (req: AuthRequest, res: Response) => {
  const logs = db.prepare('SELECT * FROM server_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT 100').all(req.params.id);
  res.json(logs.reverse());
});

router.post('/:id/reinstall', (req: AuthRequest, res: Response) => {
  const server = db.prepare(`
    SELECT s.*, e.name as egg_name FROM servers s JOIN eggs e ON s.egg_id = e.id WHERE s.id = ?
  `).get(req.params.id) as { owner_id: string; name: string; egg_name: string } | undefined;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'admin' && server.owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  if (processManager.isRunning(req.params.id)) {
    processManager.stopServer(req.params.id, true);
  }

  db.prepare("UPDATE servers SET status = 'installing' WHERE id = ?").run(req.params.id);
  pullServerImage(server.egg_name, req.params.id);
  res.json({ success: true });
});

export default router;
