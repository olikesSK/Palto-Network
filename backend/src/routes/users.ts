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

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, username, email, hash, role || 'user');
  res.status(201).json(db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(id));
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === 'admin';
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
