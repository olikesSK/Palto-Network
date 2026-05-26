import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

function checkAccess(req: AuthRequest, serverId: string): boolean {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string } | undefined;
  if (!server) return false;
  if (req.user!.role === 'admin' || req.user!.role === 'helper') return true;
  return server.owner_id === req.user!.id;
}

function generatePassword(): string {
  return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

function generateUsername(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `wz_${clean}_${crypto.randomBytes(3).toString('hex')}`;
}

// GET /api/servers/:id/databases
router.get('/:id/databases', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const databases = db.prepare("SELECT * FROM server_databases WHERE server_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(databases);
});

// POST /api/servers/:id/databases
router.post('/:id/databases', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = uuidv4();
  const dbUsername = generateUsername(name);
  const dbPassword = generatePassword();
  const dbName = `wz_${req.params.id.slice(0, 8)}_${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;

  db.prepare("INSERT INTO server_databases (id, server_id, name, db_username, db_password) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.params.id, dbName, dbUsername, dbPassword);

  res.status(201).json(db.prepare("SELECT * FROM server_databases WHERE id = ?").get(id));
});

// DELETE /api/servers/:id/databases/:dbId
router.delete('/:id/databases/:dbId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare("DELETE FROM server_databases WHERE id = ? AND server_id = ?").run(req.params.dbId, req.params.id);
  res.json({ success: true });
});

// POST /api/servers/:id/databases/:dbId/rotate
router.post('/:id/databases/:dbId/rotate', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const newPassword = generatePassword();
  db.prepare("UPDATE server_databases SET db_password = ? WHERE id = ? AND server_id = ?").run(newPassword, req.params.dbId, req.params.id);
  res.json(db.prepare("SELECT * FROM server_databases WHERE id = ?").get(req.params.dbId));
});

export default router;
