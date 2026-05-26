import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as processManager from '../services/process';

const router = Router({ mergeParams: true });

// Map of scheduleId → cron task
const cronTasks = new Map<string, ScheduledTask>();

function checkAccess(req: AuthRequest, serverId: string): boolean {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string } | undefined;
  if (!server) return false;
  if (req.user!.role === 'admin' || req.user!.role === 'helper') return true;
  return server.owner_id === req.user!.id;
}

function buildCronExpression(minute: string, hour: string, dayMonth: string, month: string, dayWeek: string): string {
  return `${minute} ${hour} ${dayMonth} ${month} ${dayWeek}`;
}

function calculateNextRun(minute: string, hour: string, dayMonth: string, month: string, dayWeek: string): string {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

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

  if (dayWeek !== '*') {
    const targetDay = parseInt(dayWeek);
    while (next.getDay() !== targetDay) next.setDate(next.getDate() + 1);
  }

  void dayMonth; void month;
  return next.toISOString();
}

function executeScheduleAction(schedule: {
  id: string; server_id: string; action: string; payload: string;
}) {
  const server = db.prepare("SELECT status FROM servers WHERE id = ?").get(schedule.server_id) as { status: string } | undefined;

  switch (schedule.action) {
    case 'command':
      if (processManager.isRunning(schedule.server_id)) {
        processManager.sendCommand(schedule.server_id, schedule.payload);
      }
      break;
    case 'power_start':
      if (!processManager.isRunning(schedule.server_id)) {
        processManager.startServer(schedule.server_id);
      }
      break;
    case 'power_stop':
      if (processManager.isRunning(schedule.server_id)) {
        processManager.stopServer(schedule.server_id, false);
      }
      break;
    case 'power_restart':
      if (processManager.isRunning(schedule.server_id)) {
        processManager.stopServer(schedule.server_id, false);
        setTimeout(() => processManager.startServer(schedule.server_id), 3000);
      }
      break;
    default:
      break;
  }

  void server;

  // Update last_run and next_run in DB
  const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(schedule.id) as any;
  if (sched) {
    const next = calculateNextRun(sched.cron_minute, sched.cron_hour, sched.cron_day_month, sched.cron_month, sched.cron_day_week);
    db.prepare("UPDATE schedules SET last_run = datetime('now'), next_run = ? WHERE id = ?").run(next, schedule.id);
  }
}

function registerCronTask(schedule: {
  id: string; server_id: string; action: string; payload: string;
  cron_minute: string; cron_hour: string; cron_day_month: string; cron_month: string; cron_day_week: string;
  enabled: number;
}) {
  // Cancel existing task for this schedule
  const existing = cronTasks.get(schedule.id);
  if (existing) { existing.stop(); cronTasks.delete(schedule.id); }

  if (!schedule.enabled) return;

  const expression = buildCronExpression(
    schedule.cron_minute, schedule.cron_hour,
    schedule.cron_day_month, schedule.cron_month, schedule.cron_day_week
  );

  if (!cron.validate(expression)) return;

  const task = cron.schedule(expression, () => {
    executeScheduleAction(schedule);
  }, { timezone: 'UTC' });

  cronTasks.set(schedule.id, task);
}

// Boot: restore all enabled schedules from DB
export function restoreSchedules() {
  const schedules = db.prepare("SELECT * FROM schedules WHERE enabled = 1").all() as any[];
  schedules.forEach(s => registerCronTask(s));
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

  const {
    name,
    cron_minute = '0', cron_hour = '4', cron_day_month = '*',
    cron_month = '*', cron_day_week = '*',
    action = 'command', payload = ''
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const expression = buildCronExpression(cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week);
  if (!cron.validate(expression)) return res.status(400).json({ error: 'Invalid cron expression' });

  const id = uuidv4();
  const next_run = calculateNextRun(cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week);

  db.prepare(`INSERT INTO schedules (id, server_id, name, cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week, action, payload, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.id, name, cron_minute, cron_hour, cron_day_month, cron_month, cron_day_week, action, payload, next_run);

  const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as any;
  registerCronTask(sched);

  res.status(201).json(sched);
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

  const updated = db.prepare("SELECT * FROM schedules WHERE id = ?").get(req.params.schedId) as any;
  registerCronTask(updated);

  res.json(updated);
});

// DELETE /api/servers/:id/schedules/:schedId
router.delete('/:id/schedules/:schedId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const existing = cronTasks.get(req.params.schedId);
  if (existing) { existing.stop(); cronTasks.delete(req.params.schedId); }

  db.prepare("DELETE FROM schedules WHERE id = ? AND server_id = ?").run(req.params.schedId, req.params.id);
  res.json({ success: true });
});

export default router;
