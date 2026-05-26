import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/audit
router.get('/', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const user = req.query.user as string;
  const action = req.query.action as string;
  const resource = req.query.resource as string;

  let query = "SELECT * FROM audit_logs WHERE 1=1";
  const params: (string | number)[] = [];

  if (user) { query += " AND username LIKE ?"; params.push(`%${user}%`); }
  if (action) { query += " AND action LIKE ?"; params.push(`%${action}%`); }
  if (resource) { query += " AND resource LIKE ?"; params.push(`%${resource}%`); }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

export default router;
