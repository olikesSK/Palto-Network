import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: AuthRequest, res: Response) => {
  const eggs = db.prepare('SELECT * FROM eggs ORDER BY category, name').all();
  res.json(eggs);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const egg = db.prepare('SELECT * FROM eggs WHERE id = ?').get(req.params.id);
  if (!egg) return res.status(404).json({ error: 'Egg not found' });
  res.json(egg);
});

router.post('/', requireAdmin, (req: AuthRequest, res: Response) => {
  const { name, description, category, docker_image, startup, config_stop, variables, icon, color } = req.body;
  if (!name || !docker_image) return res.status(400).json({ error: 'name and docker_image required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO eggs (id, name, description, category, docker_image, startup, config_stop, variables, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', category || 'Other', docker_image, startup || '', config_stop || 'stop', JSON.stringify(variables || []), icon || 'server', color || '#6366f1');

  res.status(201).json(db.prepare('SELECT * FROM eggs WHERE id = ?').get(id));
});

router.put('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const egg = db.prepare('SELECT * FROM eggs WHERE id = ?').get(req.params.id);
  if (!egg) return res.status(404).json({ error: 'Egg not found' });

  const { name, description, category, docker_image, startup, config_stop, variables, icon, color } = req.body;
  db.prepare(`UPDATE eggs SET name=COALESCE(?,name), description=COALESCE(?,description), category=COALESCE(?,category), docker_image=COALESCE(?,docker_image), startup=COALESCE(?,startup), config_stop=COALESCE(?,config_stop), icon=COALESCE(?,icon), color=COALESCE(?,color) WHERE id=?`)
    .run(name, description, category, docker_image, startup, config_stop, icon, color, req.params.id);

  if (variables) {
    db.prepare('UPDATE eggs SET variables=? WHERE id=?').run(JSON.stringify(variables), req.params.id);
  }

  res.json(db.prepare('SELECT * FROM eggs WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const egg = db.prepare('SELECT * FROM eggs WHERE id = ?').get(req.params.id);
  if (!egg) return res.status(404).json({ error: 'Egg not found' });
  db.prepare('DELETE FROM eggs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
