import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { db } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SERVER_DATA_ROOT, BACKUP_DATA_ROOT } from '../services/process';

const router = Router({ mergeParams: true });

fs.mkdirSync(BACKUP_DATA_ROOT, { recursive: true });

function checkAccess(req: AuthRequest, serverId: string): boolean {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { owner_id: string } | undefined;
  if (!server) return false;
  if (req.user!.role === 'admin' || req.user!.role === 'helper') return true;
  return server.owner_id === req.user!.id;
}

// GET /api/servers/:id/backups
router.get('/:id/backups', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const backups = db.prepare("SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(backups);
});

// POST /api/servers/:id/backups
router.post('/:id/backups', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const { name, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = uuidv4();
  const archiveName = `backup_${id}.tar.gz`;
  const archivePath = path.join(BACKUP_DATA_ROOT, archiveName);
  const serverPath = path.join(SERVER_DATA_ROOT, req.params.id);

  db.prepare("INSERT INTO backups (id, server_id, name, note, status, size) VALUES (?, ?, ?, ?, 'pending', 0)")
    .run(id, req.params.id, name, note || '');

  // Create server dir if it doesn't exist yet
  fs.mkdirSync(serverPath, { recursive: true });

  // Run real tar compression in background
  exec(`tar -czf "${archivePath}" -C "${path.dirname(serverPath)}" "${path.basename(serverPath)}"`, (err) => {
    if (err) {
      db.prepare("UPDATE backups SET status = 'failed' WHERE id = ?").run(id);
      return;
    }
    try {
      const stat = fs.statSync(archivePath);
      db.prepare("UPDATE backups SET status = 'completed', size = ? WHERE id = ?").run(stat.size, id);
    } catch {
      db.prepare("UPDATE backups SET status = 'failed' WHERE id = ?").run(id);
    }
  });

  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(id);
  res.status(201).json(backup);
});

// POST /api/servers/:id/backups/:backupId/restore
router.post('/:id/backups/:backupId/restore', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const backup = db.prepare("SELECT * FROM backups WHERE id = ? AND server_id = ?").get(req.params.backupId, req.params.id) as { id: string; status: string } | undefined;
  if (!backup) return res.status(404).json({ error: 'Backup not found' });
  if (backup.status !== 'completed') return res.status(400).json({ error: 'Backup not completed' });

  const archivePath = path.join(BACKUP_DATA_ROOT, `backup_${backup.id}.tar.gz`);
  if (!fs.existsSync(archivePath)) {
    return res.status(404).json({ error: 'Backup archive not found on disk' });
  }

  const serverPath = path.join(SERVER_DATA_ROOT, req.params.id);

  db.prepare("UPDATE servers SET status = 'installing' WHERE id = ?").run(req.params.id);

  // Extract to a temp dir then replace server dir
  const tmpDir = path.join(BACKUP_DATA_ROOT, `restore_${Date.now()}`);
  exec(`mkdir -p "${tmpDir}" && tar -xzf "${archivePath}" -C "${tmpDir}"`, (err) => {
    if (err) {
      db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(req.params.id);
      return;
    }
    try {
      if (fs.existsSync(serverPath)) fs.rmSync(serverPath, { recursive: true, force: true });
      // Find extracted dir
      const entries = fs.readdirSync(tmpDir);
      if (entries.length > 0) {
        fs.renameSync(path.join(tmpDir, entries[0]), serverPath);
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(req.params.id);
  });

  res.json({ success: true });
});

// DELETE /api/servers/:id/backups/:backupId
router.delete('/:id/backups/:backupId', authenticate, (req: AuthRequest, res: Response) => {
  if (!checkAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });

  const backup = db.prepare("SELECT id FROM backups WHERE id = ? AND server_id = ?").get(req.params.backupId, req.params.id) as { id: string } | undefined;
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  // Delete archive from disk
  const archivePath = path.join(BACKUP_DATA_ROOT, `backup_${backup.id}.tar.gz`);
  if (fs.existsSync(archivePath)) {
    try { fs.unlinkSync(archivePath); } catch { /* ignore */ }
  }

  db.prepare("DELETE FROM backups WHERE id = ? AND server_id = ?").run(req.params.backupId, req.params.id);
  res.json({ success: true });
});

export default router;
