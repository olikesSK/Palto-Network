import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

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

// GET /api/servers/:id/files?path=/
router.get('/:id/files', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const dirPath = (req.query.path as string) || '/';
  const normalizedDir = dirPath.endsWith('/') ? dirPath : dirPath + '/';

  const files = db.prepare("SELECT * FROM virtual_files WHERE server_id = ?").all(serverId) as Array<{
    id: string; path: string; content: string; size: number; is_dir: number; created_at: string; updated_at: string;
  }>;

  // Direct children only
  const children = files.filter(f => {
    if (f.path === normalizedDir || f.path === '/') return false;
    // Check if it's a direct child of normalizedDir
    if (!f.path.startsWith(normalizedDir)) {
      // Special case: root dir children
      if (normalizedDir === '/') {
        const rel = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        const parts = rel.split('/').filter(Boolean);
        return parts.length === 1 || (parts.length === 0 && f.is_dir);
      }
      return false;
    }
    const rel = f.path.slice(normalizedDir.length);
    const parts = rel.split('/').filter(Boolean);
    return parts.length <= 1;
  });

  res.json(children.map(f => ({
    id: f.id,
    name: f.path.split('/').filter(Boolean).pop() || f.path,
    path: f.path,
    is_dir: f.is_dir === 1,
    size: f.size,
    created_at: f.created_at,
    updated_at: f.updated_at,
  })));
});

// GET /api/servers/:id/files/content?path=/server.properties
router.get('/:id/files/content', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const file = db.prepare("SELECT * FROM virtual_files WHERE server_id = ? AND path = ?").get(serverId, filePath) as { content: string } | undefined;
  if (!file) return res.status(404).json({ error: 'File not found' });

  res.json({ content: file.content });
});

// PUT /api/servers/:id/files/content
router.put('/:id/files/content', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const existing = db.prepare("SELECT id FROM virtual_files WHERE server_id = ? AND path = ?").get(serverId, filePath);
  if (!existing) return res.status(404).json({ error: 'File not found' });

  db.prepare("UPDATE virtual_files SET content = ?, size = ?, updated_at = datetime('now') WHERE server_id = ? AND path = ?")
    .run(content || '', (content || '').length, serverId, filePath);

  res.json({ success: true });
});

// POST /api/servers/:id/files/mkdir
router.post('/:id/files/mkdir', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: 'path required' });

  const normalizedPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
  try {
    db.prepare("INSERT INTO virtual_files (id, server_id, path, content, size, is_dir) VALUES (?, ?, ?, '', 0, 1)")
      .run(uuidv4(), serverId, normalizedPath);
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'Directory already exists' });
  }
});

// POST /api/servers/:id/files/create
router.post('/:id/files/create', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  try {
    db.prepare("INSERT INTO virtual_files (id, server_id, path, content, size, is_dir) VALUES (?, ?, ?, ?, ?, 0)")
      .run(uuidv4(), serverId, filePath, content || '', (content || '').length);
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'File already exists' });
  }
});

// DELETE /api/servers/:id/files
router.delete('/:id/files', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const filePath = req.body.path || req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  // Delete file and any children (for directories)
  db.prepare("DELETE FROM virtual_files WHERE server_id = ? AND (path = ? OR path LIKE ?)").run(serverId, filePath, filePath + '%');
  res.json({ success: true });
});

// POST /api/servers/:id/files/rename
router.post('/:id/files/rename', authenticate, (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  if (!checkAccess(req, serverId)) return res.status(403).json({ error: 'Forbidden' });

  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });

  db.prepare("UPDATE virtual_files SET path = ?, updated_at = datetime('now') WHERE server_id = ? AND path = ?")
    .run(newPath, serverId, oldPath);
  res.json({ success: true });
});

export default router;
