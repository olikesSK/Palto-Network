import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/email';

const router = Router();

const PUBLIC_KEYS = ['panel_name', 'panel_description', 'panel_color'];

// GET /api/settings
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === 'admin';
  const rows = db.prepare("SELECT key, value FROM panel_settings").all() as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));

  if (!isAdmin) {
    const publicSettings: Record<string, string> = {};
    PUBLIC_KEYS.forEach(k => { if (settings[k]) publicSettings[k] = settings[k]; });
    return res.json(publicSettings);
  }

  res.json(settings);
});

// PUT /api/settings
router.put('/', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const updates = req.body as Record<string, string>;
  const stmt = db.prepare("INSERT OR REPLACE INTO panel_settings (key, value) VALUES (?, ?)");
  Object.entries(updates).forEach(([k, v]) => stmt.run(k, v));
  res.json({ success: true });
});

// POST /api/settings/test-email
router.post('/test-email', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await sendEmail(
      req.user!.username + '@test.com',
      'Test e-mail z Wizz-Craft',
      '<h1>Test e-mail</h1><p>SMTP konfigurace funguje správně!</p>'
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Nepodařilo se odeslat testovací e-mail' });
  }
});

export default router;
