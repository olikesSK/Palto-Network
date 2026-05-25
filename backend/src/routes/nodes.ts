import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: AuthRequest, res: Response) => {
  const nodes = db.prepare(`
    SELECT n.*,
      COALESCE(SUM(s.memory), 0) as used_memory,
      COALESCE(SUM(s.disk), 0) as used_disk,
      COALESCE(SUM(s.cpu), 0) as used_cpu,
      COUNT(s.id) as server_count
    FROM nodes n
    LEFT JOIN servers s ON n.id = s.node_id
    GROUP BY n.id
    ORDER BY n.name
  `).all();
  res.json(nodes);
});

router.post('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const { name, fqdn, port, memory, disk, cpu } = req.body;
  if (!name || !fqdn) return res.status(400).json({ error: 'name and fqdn required' });

  const id = uuidv4();
  db.prepare('INSERT INTO nodes (id, name, fqdn, port, memory, disk, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, fqdn, port || 8080, memory || 8192, disk || 102400, cpu || 400);

  res.status(201).json(db.prepare('SELECT * FROM nodes WHERE id = ?').get(id));
});

router.patch('/:id/status', requireAdmin, (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['online', 'offline', 'maintenance'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const servers = db.prepare('SELECT id FROM servers WHERE node_id = ?').all(req.params.id);
  if (servers.length > 0) return res.status(400).json({ error: 'Node has active servers' });
  db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
