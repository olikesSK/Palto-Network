import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

// GET /api/servers/:id/subusers
router.get('/', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'zakladatel' && server.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const subusers = db.prepare(`
    SELECT ss.*, u.username, u.email, u.role
    FROM server_subusers ss
    JOIN users u ON ss.user_id = u.id
    WHERE ss.server_id = ?
    ORDER BY ss.created_at ASC
  `).all(req.params.id);

  res.json(subusers);
});

// POST /api/servers/:id/subusers
router.post('/', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'zakladatel' && server.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { user_id, permissions } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT id FROM server_subusers WHERE server_id = ? AND user_id = ?').get(req.params.id, user_id);
  if (existing) return res.status(409).json({ error: 'User is already a sub-user of this server' });

  const id = uuidv4();
  const perms = permissions
    ? JSON.stringify(permissions)
    : '{"console":true,"power":true,"files":false,"settings":false}';

  db.prepare('INSERT INTO server_subusers (id, server_id, user_id, permissions) VALUES (?, ?, ?, ?)').run(id, req.params.id, user_id, perms);

  const row = db.prepare(`
    SELECT ss.*, u.username, u.email, u.role
    FROM server_subusers ss
    JOIN users u ON ss.user_id = u.id
    WHERE ss.id = ?
  `).get(id);

  res.status(201).json(row);
});

// PATCH /api/servers/:id/subusers/:userId
router.patch('/:userId', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'zakladatel' && server.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { permissions } = req.body;
  if (!permissions) return res.status(400).json({ error: 'permissions required' });

  db.prepare('UPDATE server_subusers SET permissions = ? WHERE server_id = ? AND user_id = ?')
    .run(JSON.stringify(permissions), req.params.id, req.params.userId);

  const row = db.prepare(`
    SELECT ss.*, u.username, u.email, u.role
    FROM server_subusers ss
    JOIN users u ON ss.user_id = u.id
    WHERE ss.server_id = ? AND ss.user_id = ?
  `).get(req.params.id, req.params.userId);

  if (!row) return res.status(404).json({ error: 'Sub-user not found' });
  res.json(row);
});

// DELETE /api/servers/:id/subusers/:userId
router.delete('/:userId', (req: AuthRequest, res: Response) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id) as any;
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (req.user!.role !== 'zakladatel' && server.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM server_subusers WHERE server_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ success: true });
});

export default router;
