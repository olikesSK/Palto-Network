import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SERVER_DATA_ROOT } from '../services/process';

const router = Router({ mergeParams: true });

function serverDir(serverId: string): string {
  const dir = path.join(SERVER_DATA_ROOT, serverId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safePath(base: string, reqPath: string): string | null {
  const normalized = path.normalize(reqPath || '/');
  const full = path.join(base, normalized);
  if (!full.startsWith(base)) return null;
  return full;
}

function checkAccess(req: AuthRequest, serverId: string): boolean {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string } | undefined;
  if (!server) return false;
  if (req.user!.role === 'admin' || req.user!.role === 'helper') return true;
  if (server.owner_id === req.user!.id) return true;
  const subuser = db.prepare('SELECT permissions FROM server_subusers WHERE server_id = ? AND user_id = ?').get(serverId, req.user!.id) as { permissions: string } | undefined;
  if (subuser) {
    const perms = JSON.parse(subuser.permissions);
    return !!perms.files;
  }
  return false;
}

function statToEntry(base: string, fullPath: string) {
  const stat = fs.statSync(fullPath);
  const rel = '/' + path.relative(base, fullPath);
  return {
    name: path.basename(fullPath),
    path: rel,
    is_dir: stat.isDirectory(),
    size: stat.isFile() ? stat.size : 0,
    created_at: stat.birthtime.toISOString(),
    updated_at: stat.mtime.toISOString(),
  };
}

// GET /api/servers/:id/files?path=/
router.get('/:id/files', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const reqPath = (req.query.path as string) || '/';
  const full = safePath(base, reqPath);
  if (!full) return res.status(400).json({ error: 'Invalid path' });

  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    return res.json([]);
  }

  try {
    const entries = fs.readdirSync(full).map(name => {
      const fp = path.join(full, name);
      try { return statToEntry(base, fp); } catch { return null; }
    }).filter(Boolean);
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:id/files/content?path=/server.properties
router.get('/:id/files/content', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const full = safePath(base, filePath);
  if (!full) return res.status(400).json({ error: 'Invalid path' });

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Limit reads to 2MB
  const stat = fs.statSync(full);
  if (stat.size > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'File too large to edit (max 2MB)' });
  }

  const content = fs.readFileSync(full, 'utf8');
  res.json({ content });
});

// PUT /api/servers/:id/files/content
router.put('/:id/files/content', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const full = safePath(base, filePath);
  if (!full) return res.status(400).json({ error: 'Invalid path' });

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || '', 'utf8');
  res.json({ success: true });
});

// POST /api/servers/:id/files/mkdir
router.post('/:id/files/mkdir', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: 'path required' });

  const full = safePath(base, dirPath);
  if (!full) return res.status(400).json({ error: 'Invalid path' });

  if (fs.existsSync(full)) return res.status(409).json({ error: 'Directory already exists' });

  fs.mkdirSync(full, { recursive: true });
  res.json({ success: true });
});

// POST /api/servers/:id/files/create
router.post('/:id/files/create', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const full = safePath(base, filePath);
  if (!full) return res.status(400).json({ error: 'Invalid path' });

  if (fs.existsSync(full)) return res.status(409).json({ error: 'File already exists' });

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || '', 'utf8');
  res.json({ success: true });
});

// DELETE /api/servers/:id/files
router.delete('/:id/files', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const filePath = (req.body.path || req.query.path) as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const full = safePath(base, filePath);
  if (!full || full === base) return res.status(400).json({ error: 'Invalid path' });

  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });

  if (fs.statSync(full).isDirectory()) {
    fs.rmSync(full, { recursive: true, force: true });
  } else {
    fs.unlinkSync(full);
  }
  res.json({ success: true });
});

// POST /api/servers/:id/files/rename
router.post('/:id/files/rename', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const base = serverDir(serverId);
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });

  const oldFull = safePath(base, oldPath);
  const newFull = safePath(base, newPath);
  if (!oldFull || !newFull) return res.status(400).json({ error: 'Invalid path' });

  if (!fs.existsSync(oldFull)) return res.status(404).json({ error: 'File not found' });

  fs.mkdirSync(path.dirname(newFull), { recursive: true });
  fs.renameSync(oldFull, newFull);
  res.json({ success: true });
});

export default router;
