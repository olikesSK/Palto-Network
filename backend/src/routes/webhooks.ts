import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { fireWebhook } from '../services/discord';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/webhooks
router.get('/', (_req: AuthRequest, res: Response) => {
  const webhooks = db.prepare('SELECT * FROM discord_webhooks ORDER BY created_at DESC').all();
  res.json(webhooks);
});

// POST /api/webhooks
router.post('/', (req: AuthRequest, res: Response) => {
  const { name, url, events } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });

  const id = uuidv4();
  const eventsJson = events ? JSON.stringify(events) : '["server.start","server.stop","server.crash","server.install","user.create"]';
  db.prepare('INSERT INTO discord_webhooks (id, name, url, events) VALUES (?, ?, ?, ?)').run(id, name, url, eventsJson);

  res.status(201).json(db.prepare('SELECT * FROM discord_webhooks WHERE id = ?').get(id));
});

// PATCH /api/webhooks/:id
router.patch('/:id', (req: AuthRequest, res: Response) => {
  const wh = db.prepare('SELECT * FROM discord_webhooks WHERE id = ?').get(req.params.id) as any;
  if (!wh) return res.status(404).json({ error: 'Webhook not found' });

  const { name, url, events, enabled } = req.body;
  if (name !== undefined) db.prepare('UPDATE discord_webhooks SET name = ? WHERE id = ?').run(name, req.params.id);
  if (url !== undefined) db.prepare('UPDATE discord_webhooks SET url = ? WHERE id = ?').run(url, req.params.id);
  if (events !== undefined) db.prepare('UPDATE discord_webhooks SET events = ? WHERE id = ?').run(JSON.stringify(events), req.params.id);
  if (enabled !== undefined) db.prepare('UPDATE discord_webhooks SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);

  res.json(db.prepare('SELECT * FROM discord_webhooks WHERE id = ?').get(req.params.id));
});

// DELETE /api/webhooks/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const wh = db.prepare('SELECT * FROM discord_webhooks WHERE id = ?').get(req.params.id);
  if (!wh) return res.status(404).json({ error: 'Webhook not found' });
  db.prepare('DELETE FROM discord_webhooks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/webhooks/:id/test
router.post('/:id/test', (req: AuthRequest, res: Response) => {
  const wh = db.prepare('SELECT * FROM discord_webhooks WHERE id = ?').get(req.params.id) as any;
  if (!wh) return res.status(404).json({ error: 'Webhook not found' });

  fireWebhook('server.start', { Server: 'Test Server', Status: 'Test event from Palto-Network Panel' });
  res.json({ success: true, message: 'Test webhook sent' });
});

export default router;
