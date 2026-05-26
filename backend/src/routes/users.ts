import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requireAdmin, (_req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.created_at, COUNT(s.id) as server_count
    FROM users u
    LEFT JOIN servers s ON u.id = s.owner_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

router.post('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'Username or email already exists' });

  const validRoles = ['zakladatel', 'spravca', 'user'];
  const safeRole = validRoles.includes(role) ? role : 'user';
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, username, email, hash, safeRole);
  res.status(201).json(db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(id));
});

router.get('/:id/stats', requireAdmin, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.params.id) as { id: string; username: string; email: string; role: string; created_at: string } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const servers = db.prepare(`
    SELECT s.id, s.name, s.status, s.memory, s.cpu, s.disk, n.name as node_name, e.name as egg_name
    FROM servers s
    JOIN nodes n ON s.node_id = n.id
    JOIN eggs e ON s.egg_id = e.id
    WHERE s.owner_id = ?
    ORDER BY s.created_at DESC
  `).all(req.params.id) as { id: string; name: string; status: string; memory: number; cpu: number; disk: number; node_name: string; egg_name: string }[];

  const totalMemory = servers.reduce((sum, s) => sum + s.memory, 0);
  const totalCpu = servers.reduce((sum, s) => sum + s.cpu, 0);

  res.json({
    user,
    server_count: servers.length,
    total_memory: totalMemory,
    total_cpu: totalCpu,
    servers,
    created_at: user.created_at,
  });
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === 'zakladatel';
  const isSelf = req.user!.id === req.params.id;
  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  const { username, email, password } = req.body;
  if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.params.id);
  if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.params.id);
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id);

  res.json(db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  if (req.user!.id === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
