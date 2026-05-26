import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';
import { tempTokens } from './twofa';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as {
    id: string; role: string; username: string; email: string; password_hash: string;
    totp_enabled: number; totp_secret: string;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2FA check
  if (user.totp_enabled) {
    const tempToken = crypto.randomBytes(32).toString('hex');
    tempTokens.set(tempToken, { userId: user.id, expires: Date.now() + 5 * 60 * 1000 });
    return res.json({ requiresTOTP: true, tempToken });
  }

  const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, username, email, role, created_at, totp_enabled, language FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
