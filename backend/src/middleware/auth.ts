import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'palto-network-secret-key-2024';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; username: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // Check X-API-Key header first
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRow = db.prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(keyHash) as { id: string; user_id: string; permissions: string } | undefined;
    if (keyRow) {
      const user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(keyRow.user_id) as { id: string; username: string; role: string } | undefined;
      if (user) {
        db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(keyRow.id);
        req.user = user;
        return next();
      }
    }
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; username: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

export { JWT_SECRET };
