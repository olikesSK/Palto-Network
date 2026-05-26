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

function calculateNextRun(minute: string, hour: string, dayMonth: string, month: string, dayWeek: string): string {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  // Simple calculation - advance by period
  const m = minute === '*' ? 0 : parseInt(minute) || 0;
  const h = hour === '*' ? now.getHours() : parseInt(hour) || 0;

  if (minute !== '*' && hour !== '*') {
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (minute !== '*') {
    next.setMinutes(m, 0, 0);
    if (next <= now) next.setHours(next.getHours() + 1);
  } else {
    next.setMinutes(now.getMinutes() + 1, 0, 0);
  }

  // Handle day of week
  if (dayWeek !== '*') {
    const targetDay = parseInt(dayWeek);
    while (next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1);
    }
  }

  // Suppress unused variable warnings
  void dayMonth; void month;

  return next.toISOString();
}

// GET /api/servers/:id/schedules
router.get('/:id/schedules', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const schedules = db.prepare("SELECT * FROM schedules WHERE server_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(schedules);
});

// POST /api/servers/:id/schedules
router.post('/:id/schedules', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const { name, cron_minute = '0', cron_hour = '4', cron_day_month = '*', cron_month = '*', cron_day_week = '*', action = 'command', payload = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = uuidv4();
  const next_run = calculateNextRun(cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week);

  db.prepare(`INSERT INTO schedules (id, server_id, name, cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week, action, payload, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.id, name, cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week, action, payload, next_run);

  res.status(201).json(db.prepare("SELECT * FROM schedules WHERE id = ?").get(id));
});

// PATCH /api/servers/:id/schedules/:schedId
router.patch('/:id/schedules/:schedId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND server_id = ?").get(req.params.schedId, req.params.id) as Record<string, unknown> | undefined;
  if (!sched) return res.status(404).json({ error: 'Schedule not found' });

  const { enabled, payload, name, cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week, action } = req.body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (payload !== undefined) { updates.push('payload = ?'); values.push(payload); }
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (cron_minute !== undefined) { updates.push('cron_minute = ?'); values.push(cron_minute); }
  if (cron_hour !== undefined) { updates.push('cron_hour = ?'); values.push(cron_hour); }
  if (cron_day_month !== undefined) { updates.push('cron_day_month = ?'); values.push(cron_day_month); }
  if (cron_month !== undefined) { updates.push('cron_month = ?'); values.push(cron_month); }
  if (cron_day_week !== undefined) { updates.push('cron_day_week = ?'); values.push(cron_day_week); }
  if (action !== undefined) { updates.push('action = ?'); values.push(action); }

  if (updates.length > 0) {
    values.push(req.params.schedId);
    db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  res.json(db.prepare("SELECT * FROM schedules WHERE id = ?").get(req.params.schedId));
});

// DELETE /api/servers/:id/schedules/:schedId
router.delete('/:id/schedules/:schedId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare("DELETE FROM schedules WHERE id = ? AND server_id = ?").run(req.params.schedId, req.params.id);
  res.json({ success: true });
});

export default router;
