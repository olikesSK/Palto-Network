import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/apikeys
router.get('/', (req: AuthRequest, res: Response) => {
  const keys = db.prepare("SELECT id, name, key_preview, permissions, last_used, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC").all(req.user!.id);
  res.json(keys);
});

// POST /api/apikeys
router.post('/', (req: AuthRequest, res: Response) => {
  const { name, permissions } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const rawKey = 'wz_' + crypto.randomBytes(16).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPreview = rawKey.slice(0, 8) + '...';
  const id = uuidv4();
  const perms = Array.isArray(permissions) ? permissions : ['servers:read'];

  db.prepare("INSERT INTO api_keys (id, user_id, name, key_hash, key_preview, permissions) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, req.user!.id, name, keyHash, keyPreview, JSON.stringify(perms));

  res.status(201).json({ id, name, key: rawKey, key_preview: keyPreview, permissions: perms, created_at: new Date().toISOString() });
});

// DELETE /api/apikeys/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  db.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  res.json({ success: true });
});

export default router;
