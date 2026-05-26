import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

function checkAccess(req: AuthRequest, serverId: string): boolean {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string } | undefined;
  if (!server) return false;
  if (req.user!.role === 'admin' || req.user!.role === 'helper') return true;
  return server.owner_id === req.user!.id;
}

// GET /api/servers/:id/backups
router.get('/:id/backups', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const backups = db.prepare("SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(backups);
});

// POST /api/servers/:id/backups
router.post('/:id/backups', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const { name, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = uuidv4();
  db.prepare("INSERT INTO backups (id, server_id, name, note, status, size) VALUES (?, ?, ?, ?, 'pending', 0)")
    .run(id, req.params.id, name, note || '');

  // Simulate completion after 2s
  setTimeout(() => {
    const size = Math.floor(Math.random() * (500 - 50 + 1) + 50) * 1024 * 1024;
    db.prepare("UPDATE backups SET status = 'completed', size = ? WHERE id = ?").run(size, id);
  }, 2000);

  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(id);
  res.status(201).json(backup);
});

// POST /api/servers/:id/backups/:backupId/restore
router.post('/:id/backups/:backupId/restore', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(req.params.backupId, req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  db.prepare("UPDATE servers SET status = 'installing' WHERE id = ?").run(req.params.id);
  setTimeout(() => {
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(req.params.id);
  }, 3000);

  res.json({ success: true });
});

// DELETE /api/servers/:id/backups/:backupId
router.delete('/:id/backups/:backupId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  db.prepare("DELETE FROM backups WHERE id = ? AND server_id = ?").run(req.params.backupId, req.params.id);
  res.json({ success: true });
});

export default router;
