import { Router, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { authenticate, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

// Temp tokens for 2FA verification flow
const tempTokens = new Map<string, { userId: string; expires: number }>();

// GET /api/auth/2fa/setup
router.get('/2fa/setup', authenticate, async (req: AuthRequest, res: Response) => {
  const secret = speakeasy.generateSecret({ name: `Palto-Network:${req.user!.username}`, length: 20 });
  const qrUrl = await QRCode.toDataURL(secret.otpauth_url!);
  res.json({ secret: secret.base32, qrUrl });
});

// POST /api/auth/2fa/enable
router.post('/2fa/enable', authenticate, (req: AuthRequest, res: Response) => {
  const { token, secret } = req.body;
  if (!token || !secret) return res.status(400).json({ error: 'token and secret required' });

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!verified) return res.status(400).json({ error: 'Neplatný kód' });

  db.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?").run(secret, req.user!.id);
  res.json({ success: true });
});

// POST /api/auth/2fa/disable
router.post('/2fa/disable', authenticate, (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  const user = db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(req.user!.id) as { totp_secret: string } | undefined;
  if (!user?.totp_secret) return res.status(400).json({ error: '2FA není povolena' });

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!verified) return res.status(400).json({ error: 'Neplatný kód' });

  db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(req.user!.id);
  res.json({ success: true });
});

// POST /api/auth/2fa/verify (complete login with 2FA)
router.post('/2fa/verify', (req, res) => {
  const { tempToken, token } = req.body;
  if (!tempToken || !token) return res.status(400).json({ error: 'tempToken and token required' });

  const entry = tempTokens.get(tempToken);
  if (!entry || entry.expires < Date.now()) {
    tempTokens.delete(tempToken);
    return res.status(401).json({ error: 'Platnost dočasného tokenu vypršela' });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(entry.userId) as { id: string; role: string; username: string; email: string; totp_secret: string } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!verified) return res.status(401).json({ error: 'Neplatný TOTP kód' });

  tempTokens.delete(tempToken);
  const fullToken = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token: fullToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

export { tempTokens };
export default router;
