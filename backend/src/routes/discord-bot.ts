import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { db } from '../db/database';
import { discordBot } from '../services/discordBot';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate, requireAdmin);

// ─── Bot Config & Control ──────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  const config = db.prepare('SELECT * FROM discord_bot_config WHERE id = ?').get('main');
  if (config && (config as Record<string, unknown>).bot_token) (config as Record<string, unknown>).bot_token = '***';
  res.json(config ?? {});
});

router.patch('/config', async (req, res) => {
  const { bot_token, guild_id, prefix, activity_type, activity_text, status } = req.body;
  const existing = db.prepare('SELECT id FROM discord_bot_config WHERE id = ?').get('main');
  if (existing) {
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (bot_token && bot_token !== '***') { updates.push('bot_token = ?'); vals.push(bot_token); }
    if (guild_id !== undefined) { updates.push('guild_id = ?'); vals.push(guild_id); }
    if (prefix !== undefined) { updates.push('prefix = ?'); vals.push(prefix); }
    if (activity_type !== undefined) { updates.push('activity_type = ?'); vals.push(activity_type); }
    if (activity_text !== undefined) { updates.push('activity_text = ?'); vals.push(activity_text); }
    if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      vals.push('main');
      db.prepare(`UPDATE discord_bot_config SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    }
  } else {
    db.prepare('INSERT INTO discord_bot_config (id, bot_token, guild_id, prefix, activity_type, activity_text, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run('main', bot_token ?? '', guild_id ?? '', prefix ?? '!', activity_type ?? 'PLAYING', activity_text ?? '', status ?? 'online');
  }
  res.json({ success: true });
});

router.get('/status', (_req, res) => {
  res.json(discordBot.getStatus());
});

router.post('/start', async (_req, res) => {
  const result = await discordBot.start();
  if (result.success) db.prepare('UPDATE discord_bot_config SET enabled = 1 WHERE id = ?').run('main');
  res.json(result);
});

router.post('/stop', async (_req, res) => {
  await discordBot.stop();
  db.prepare('UPDATE discord_bot_config SET enabled = 0 WHERE id = ?').run('main');
  res.json({ success: true });
});

router.get('/guild-info', async (req, res) => {
  const config = db.prepare('SELECT guild_id FROM discord_bot_config WHERE id = ?').get('main') as { guild_id: string } | undefined;
  if (!config?.guild_id) return res.json(null);
  const info = await discordBot.getGuildInfo(config.guild_id);
  res.json(info);
});

// ─── Ticket Config ─────────────────────────────────────────────────────────

router.get('/ticket-config', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_ticket_config WHERE id = ?').get('main') ?? {});
});

router.patch('/ticket-config', (req, res) => {
  const fields = ['enabled', 'category_id', 'log_channel_id', 'support_role_id', 'max_per_user', 'welcome_message', 'panel_title', 'panel_description', 'panel_color'];
  const updates: string[] = []; const vals: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
  }
  if (updates.length) { vals.push('main'); db.prepare(`UPDATE discord_ticket_config SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

// ─── Tickets ───────────────────────────────────────────────────────────────

router.get('/tickets', (req, res) => {
  const status = req.query.status as string;
  const query = status ? 'SELECT * FROM discord_tickets WHERE status = ? ORDER BY created_at DESC LIMIT 100' : 'SELECT * FROM discord_tickets ORDER BY created_at DESC LIMIT 100';
  const rows = status ? db.prepare(query).all(status) : db.prepare(query).all();
  res.json(rows);
});

router.delete('/tickets/:id', (req, res) => {
  db.prepare('DELETE FROM discord_tickets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Welcome Config ────────────────────────────────────────────────────────

router.get('/welcome', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_welcome_config WHERE id = ?').get('main') ?? {});
});

router.patch('/welcome', (req, res) => {
  const fields = ['enabled', 'channel_id', 'message', 'embed_enabled', 'embed_title', 'embed_color', 'embed_thumbnail', 'dm_enabled', 'dm_message', 'leave_enabled', 'leave_channel_id', 'leave_message'];
  const updates: string[] = []; const vals: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
  }
  if (updates.length) { vals.push('main'); db.prepare(`UPDATE discord_welcome_config SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

// ─── Giveaways ─────────────────────────────────────────────────────────────

router.get('/giveaways', (req, res) => {
  const active = req.query.active;
  const query = active === '1'
    ? 'SELECT * FROM discord_giveaways WHERE ended = 0 AND cancelled = 0 ORDER BY ends_at ASC'
    : 'SELECT * FROM discord_giveaways ORDER BY created_at DESC LIMIT 50';
  res.json(db.prepare(query).all());
});

router.post('/giveaways/:id/end', async (req, res) => {
  await discordBot.endGiveawayById(req.params.id);
  res.json({ success: true });
});

router.delete('/giveaways/:id', (req, res) => {
  db.prepare('UPDATE discord_giveaways SET cancelled = 1, ended = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Sticky Messages ───────────────────────────────────────────────────────

router.get('/sticky', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_sticky_messages ORDER BY created_at DESC').all());
});

router.post('/sticky', (req, res) => {
  const { channel_id, content } = req.body;
  if (!channel_id || !content) return res.status(400).json({ error: 'channel_id and content required' });
  const existing = db.prepare('SELECT id FROM discord_sticky_messages WHERE channel_id = ?').get(channel_id) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE discord_sticky_messages SET content = ?, enabled = 1 WHERE channel_id = ?').run(content, channel_id);
  } else {
    db.prepare('INSERT INTO discord_sticky_messages (id, channel_id, content) VALUES (?, ?, ?)').run(uuidv4(), channel_id, content);
  }
  res.json({ success: true });
});

router.patch('/sticky/:id', (req, res) => {
  const { content, enabled } = req.body;
  const updates: string[] = []; const vals: unknown[] = [];
  if (content !== undefined) { updates.push('content = ?'); vals.push(content); }
  if (enabled !== undefined) { updates.push('enabled = ?'); vals.push(enabled); }
  if (updates.length) { vals.push(req.params.id); db.prepare(`UPDATE discord_sticky_messages SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

router.delete('/sticky/:id', (req, res) => {
  db.prepare('DELETE FROM discord_sticky_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Auto-roles ────────────────────────────────────────────────────────────

router.get('/auto-roles', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_auto_roles ORDER BY created_at DESC').all());
});

router.post('/auto-roles', (req, res) => {
  const { role_id, role_name } = req.body;
  if (!role_id || !role_name) return res.status(400).json({ error: 'role_id and role_name required' });
  const id = uuidv4();
  db.prepare('INSERT OR IGNORE INTO discord_auto_roles (id, role_id, role_name) VALUES (?, ?, ?)').run(id, role_id, role_name);
  res.json({ success: true, id });
});

router.patch('/auto-roles/:id', (req, res) => {
  const { enabled } = req.body;
  db.prepare('UPDATE discord_auto_roles SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  res.json({ success: true });
});

router.delete('/auto-roles/:id', (req, res) => {
  db.prepare('DELETE FROM discord_auto_roles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Reaction Roles ────────────────────────────────────────────────────────

router.get('/reaction-roles', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_reaction_roles ORDER BY created_at DESC').all());
});

router.post('/reaction-roles', (req, res) => {
  const { channel_id, message_id, emoji, role_id, role_name, description } = req.body;
  if (!channel_id || !message_id || !emoji || !role_id || !role_name) return res.status(400).json({ error: 'Missing required fields' });
  const id = uuidv4();
  db.prepare('INSERT INTO discord_reaction_roles (id, channel_id, message_id, emoji, role_id, role_name, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, channel_id, message_id, emoji, role_id, role_name, description ?? '');
  res.json({ success: true, id });
});

router.delete('/reaction-roles/:id', (req, res) => {
  db.prepare('DELETE FROM discord_reaction_roles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Warns ─────────────────────────────────────────────────────────────────

router.get('/warns', (req, res) => {
  const userId = req.query.user_id as string;
  const rows = userId
    ? db.prepare('SELECT * FROM discord_warns WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    : db.prepare('SELECT * FROM discord_warns ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

router.delete('/warns/:id', (req, res) => {
  db.prepare('DELETE FROM discord_warns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Mod Logs ──────────────────────────────────────────────────────────────

router.get('/mod-logs', (req, res) => {
  const userId = req.query.user_id as string;
  const action = req.query.action as string;
  let query = 'SELECT * FROM discord_mod_logs WHERE 1=1';
  const vals: unknown[] = [];
  if (userId) { query += ' AND user_id = ?'; vals.push(userId); }
  if (action) { query += ' AND action = ?'; vals.push(action); }
  query += ' ORDER BY created_at DESC LIMIT 100';
  res.json(db.prepare(query).all(...vals));
});

// ─── Logging Config ────────────────────────────────────────────────────────

router.get('/logging', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_logging_config WHERE id = ?').get('main') ?? {});
});

router.patch('/logging', (req, res) => {
  const fields = ['enabled', 'message_delete_channel', 'message_edit_channel', 'member_join_channel', 'member_leave_channel', 'role_change_channel', 'voice_activity_channel', 'ban_channel'];
  const updates: string[] = []; const vals: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
  }
  if (updates.length) { vals.push('main'); db.prepare(`UPDATE discord_logging_config SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

// ─── Levels ────────────────────────────────────────────────────────────────

router.get('/levels', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_levels ORDER BY level DESC, xp DESC LIMIT 50').all());
});

router.delete('/levels/:userId', (req, res) => {
  db.prepare('DELETE FROM discord_levels WHERE user_id = ?').run(req.params.userId);
  res.json({ success: true });
});

router.get('/level-roles', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_level_roles ORDER BY level ASC').all());
});

router.post('/level-roles', (req, res) => {
  const { level, role_id, role_name } = req.body;
  if (level === undefined || !role_id || !role_name) return res.status(400).json({ error: 'Missing required fields' });
  db.prepare('INSERT OR IGNORE INTO discord_level_roles (id, level, role_id, role_name) VALUES (?, ?, ?, ?)').run(uuidv4(), level, role_id, role_name);
  res.json({ success: true });
});

router.delete('/level-roles/:id', (req, res) => {
  db.prepare('DELETE FROM discord_level_roles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Custom Commands ───────────────────────────────────────────────────────

router.get('/commands', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discord_custom_commands ORDER BY created_at DESC').all());
});

router.post('/commands', (req, res) => {
  const { trigger, response, embed_enabled, embed_color } = req.body;
  if (!trigger || !response) return res.status(400).json({ error: 'trigger and response required' });
  const id = uuidv4();
  db.prepare('INSERT INTO discord_custom_commands (id, trigger, response, embed_enabled, embed_color) VALUES (?, ?, ?, ?, ?)').run(id, trigger.toLowerCase(), response, embed_enabled ? 1 : 0, embed_color ?? '#7c3aed');
  res.json({ success: true, id });
});

router.patch('/commands/:id', (req, res) => {
  const fields = ['trigger', 'response', 'embed_enabled', 'embed_color', 'enabled'];
  const updates: string[] = []; const vals: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(f === 'trigger' ? String(req.body[f]).toLowerCase() : req.body[f]); }
  }
  if (updates.length) { vals.push(req.params.id); db.prepare(`UPDATE discord_custom_commands SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

router.delete('/commands/:id', (req, res) => {
  db.prepare('DELETE FROM discord_custom_commands WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Automod Config ────────────────────────────────────────────────────────

router.get('/automod', (_req, res) => {
  const cfg = db.prepare('SELECT * FROM discord_automod_config WHERE id = ?').get('main');
  if (cfg) (cfg as Record<string, unknown>).bad_words = JSON.parse((cfg as Record<string, unknown>).bad_words as string || '[]');
  res.json(cfg ?? {});
});

router.patch('/automod', (req, res) => {
  const fields = ['enabled', 'anti_spam', 'anti_links', 'anti_invites', 'log_channel', 'spam_threshold', 'spam_interval'];
  const updates: string[] = []; const vals: unknown[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
  }
  if (req.body.bad_words !== undefined) { updates.push('bad_words = ?'); vals.push(JSON.stringify(req.body.bad_words)); }
  if (updates.length) { vals.push('main'); db.prepare(`UPDATE discord_automod_config SET ${updates.join(', ')} WHERE id = ?`).run(...vals); }
  res.json({ success: true });
});

export default router;
