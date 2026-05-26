import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/announcements
router.get('/', authenticate, (_req, res: Response) => {
  const announcements = db.prepare("SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC").all();
  res.json(announcements);
});

// POST /api/announcements
router.post('/', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const { title, message, type } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });

  const id = uuidv4();
  db.prepare("INSERT INTO announcements (id, title, message, type, created_by) VALUES (?, ?, ?, ?, ?)")
    .run(id, title, message, type || 'info', req.user!.username);

  const announcement = db.prepare("SELECT * FROM announcements WHERE id = ?").get(id);
  res.status(201).json(announcement);
});

// DELETE /api/announcements/:id
router.delete('/:id', authenticate, requireAdmin, (req, res: Response) => {
  db.prepare("UPDATE announcements SET active = 0 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
