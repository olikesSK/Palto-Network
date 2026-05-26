import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '../../data/palto-network.db');

import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

export function initDatabase() {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fqdn TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 8080,
      memory INTEGER NOT NULL DEFAULT 8192,
      disk INTEGER NOT NULL DEFAULT 102400,
      cpu INTEGER NOT NULL DEFAULT 400,
      status TEXT NOT NULL DEFAULT 'online',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eggs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Other',
      docker_image TEXT NOT NULL,
      startup TEXT NOT NULL DEFAULT '',
      config_files TEXT NOT NULL DEFAULT '{}',
      config_startup TEXT NOT NULL DEFAULT '{}',
      config_stop TEXT NOT NULL DEFAULT 'stop',
      variables TEXT NOT NULL DEFAULT '[]',
      icon TEXT NOT NULL DEFAULT 'server',
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL REFERENCES users(id),
      node_id TEXT NOT NULL REFERENCES nodes(id),
      egg_id TEXT NOT NULL REFERENCES eggs(id),
      status TEXT NOT NULL DEFAULT 'stopped',
      memory INTEGER NOT NULL DEFAULT 1024,
      disk INTEGER NOT NULL DEFAULT 10240,
      cpu INTEGER NOT NULL DEFAULT 100,
      port INTEGER NOT NULL DEFAULT 25565,
      environment TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL REFERENCES servers(id),
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'output',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_subusers (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permissions TEXT NOT NULL DEFAULT '{"console":true,"power":true,"files":false,"settings":false}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(server_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS discord_webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '["server.start","server.stop","server.crash","server.install","user.create"]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'global',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS virtual_files (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      is_dir INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(server_id, path)
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cron_minute TEXT NOT NULL DEFAULT '0',
      cron_hour TEXT NOT NULL DEFAULT '4',
      cron_day_month TEXT NOT NULL DEFAULT '*',
      cron_month TEXT NOT NULL DEFAULT '*',
      cron_day_week TEXT NOT NULL DEFAULT '*',
      action TEXT NOT NULL DEFAULT 'command',
      payload TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_preview TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '["servers:read"]',
      last_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_databases (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      db_username TEXT NOT NULL,
      db_password TEXT NOT NULL,
      host TEXT NOT NULL DEFAULT '127.0.0.1',
      port INTEGER NOT NULL DEFAULT 3306,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      created_by TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS panel_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Discord Bot tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS discord_bot_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      bot_token TEXT NOT NULL DEFAULT '',
      guild_id TEXT NOT NULL DEFAULT '',
      prefix TEXT NOT NULL DEFAULT '!',
      activity_type TEXT NOT NULL DEFAULT 'PLAYING',
      activity_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'online',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_ticket_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      enabled INTEGER NOT NULL DEFAULT 0,
      category_id TEXT NOT NULL DEFAULT '',
      log_channel_id TEXT NOT NULL DEFAULT '',
      support_role_id TEXT NOT NULL DEFAULT '',
      max_per_user INTEGER NOT NULL DEFAULT 1,
      welcome_message TEXT NOT NULL DEFAULT 'Welcome {user} to your ticket! Our support team will be with you shortly.',
      panel_title TEXT NOT NULL DEFAULT 'Support Tickets',
      panel_description TEXT NOT NULL DEFAULT 'Click the button below to open a support ticket.',
      panel_color TEXT NOT NULL DEFAULT '#7c3aed'
    );

    CREATE TABLE IF NOT EXISTS discord_tickets (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      closed_by_id TEXT,
      closed_by_username TEXT
    );

    CREATE TABLE IF NOT EXISTS discord_welcome_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      enabled INTEGER NOT NULL DEFAULT 0,
      channel_id TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT 'Welcome {user} to **{server}**! You are member #{count}.',
      embed_enabled INTEGER NOT NULL DEFAULT 1,
      embed_title TEXT NOT NULL DEFAULT 'Welcome to {server}!',
      embed_color TEXT NOT NULL DEFAULT '#7c3aed',
      embed_thumbnail INTEGER NOT NULL DEFAULT 1,
      dm_enabled INTEGER NOT NULL DEFAULT 0,
      dm_message TEXT NOT NULL DEFAULT 'Welcome to {server}! Please read the rules.',
      leave_enabled INTEGER NOT NULL DEFAULT 0,
      leave_channel_id TEXT NOT NULL DEFAULT '',
      leave_message TEXT NOT NULL DEFAULT '**{username}** has left **{server}**. We now have {count} members.'
    );

    CREATE TABLE IF NOT EXISTS discord_giveaways (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL DEFAULT '',
      prize TEXT NOT NULL,
      winners_count INTEGER NOT NULL DEFAULT 1,
      host_id TEXT NOT NULL,
      host_username TEXT NOT NULL,
      entries TEXT NOT NULL DEFAULT '[]',
      winners TEXT NOT NULL DEFAULT '[]',
      ends_at TEXT NOT NULL,
      ended INTEGER NOT NULL DEFAULT 0,
      cancelled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_sticky_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      last_message_id TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_auto_roles (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_reaction_roles (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_warns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_username TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_mod_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_username TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_logging_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      enabled INTEGER NOT NULL DEFAULT 0,
      message_delete_channel TEXT NOT NULL DEFAULT '',
      message_edit_channel TEXT NOT NULL DEFAULT '',
      member_join_channel TEXT NOT NULL DEFAULT '',
      member_leave_channel TEXT NOT NULL DEFAULT '',
      role_change_channel TEXT NOT NULL DEFAULT '',
      voice_activity_channel TEXT NOT NULL DEFAULT '',
      ban_channel TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS discord_levels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      messages INTEGER NOT NULL DEFAULT 0,
      last_xp_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_level_roles (
      id TEXT PRIMARY KEY,
      level INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_custom_commands (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL UNIQUE,
      response TEXT NOT NULL,
      embed_enabled INTEGER NOT NULL DEFAULT 0,
      embed_color TEXT NOT NULL DEFAULT '#7c3aed',
      enabled INTEGER NOT NULL DEFAULT 1,
      uses INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_automod_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      enabled INTEGER NOT NULL DEFAULT 0,
      anti_spam INTEGER NOT NULL DEFAULT 0,
      anti_links INTEGER NOT NULL DEFAULT 1,
      anti_invites INTEGER NOT NULL DEFAULT 1,
      bad_words TEXT NOT NULL DEFAULT '[]',
      log_channel TEXT NOT NULL DEFAULT '',
      spam_threshold INTEGER NOT NULL DEFAULT 5,
      spam_interval INTEGER NOT NULL DEFAULT 5
    );
  `);

  // Seed default bot config rows
  try {
    db.exec("INSERT OR IGNORE INTO discord_bot_config (id) VALUES ('main')");
    db.exec("INSERT OR IGNORE INTO discord_ticket_config (id) VALUES ('main')");
    db.exec("INSERT OR IGNORE INTO discord_welcome_config (id) VALUES ('main')");
    db.exec("INSERT OR IGNORE INTO discord_logging_config (id) VALUES ('main')");
    db.exec("INSERT OR IGNORE INTO discord_automod_config (id) VALUES ('main')");
  } catch {}

  // Column migrations
  try { db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'cs'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1"); } catch {}

  seedData();
}

function seedServerFiles(serverId: string, eggName: string) {
  const files: Array<{path: string; content: string; is_dir: number}> = [];

  if (eggName.includes('Minecraft') || eggName.includes('minecraft')) {
    files.push(
      { path: '/', content: '', is_dir: 1 },
      { path: '/server.properties', content: `server-port=25565\nmax-players=20\nmotd=Palto-Network Server\ngamemode=survival\ndifficulty=normal\nspawn-protection=16\nonline-mode=true\nlevel-name=world\n`, is_dir: 0 },
      { path: '/ops.json', content: '[]', is_dir: 0 },
      { path: '/whitelist.json', content: '[]', is_dir: 0 },
      { path: '/banned-players.json', content: '[]', is_dir: 0 },
      { path: '/logs/', content: '', is_dir: 1 },
      { path: '/logs/latest.log', content: '[00:00:01] [Server thread/INFO]: Starting Minecraft server\n[00:00:02] [Server thread/INFO]: Loading properties\n[00:00:03] [Server thread/INFO]: Done (2.5s)!\n', is_dir: 0 },
      { path: '/world/', content: '', is_dir: 1 },
      { path: '/plugins/', content: '', is_dir: 1 },
    );
  } else if (eggName.includes('Rust')) {
    files.push(
      { path: '/', content: '', is_dir: 1 },
      { path: '/server.cfg', content: `server.hostname "Palto-Network Rust"\nserver.maxplayers 100\nserver.description "Powered by Palto-Network"\n`, is_dir: 0 },
      { path: '/oxide/', content: '', is_dir: 1 },
      { path: '/oxide/config/', content: '', is_dir: 1 },
      { path: '/saves/', content: '', is_dir: 1 },
    );
  } else if (eggName.includes('Counter')) {
    files.push(
      { path: '/', content: '', is_dir: 1 },
      { path: '/game/cfg/', content: '', is_dir: 1 },
      { path: '/game/cfg/server.cfg', content: `hostname "Palto-Network CS2"\nrcon_password "changeme"\nmp_autoteambalance 1\nmp_maxrounds 30\n`, is_dir: 0 },
    );
  } else {
    files.push(
      { path: '/', content: '', is_dir: 1 },
      { path: '/config.json', content: JSON.stringify({ port: 25565, debug: false }, null, 2), is_dir: 0 },
      { path: '/logs/', content: '', is_dir: 1 },
    );
  }

  const ins = db.prepare("INSERT OR IGNORE INTO virtual_files (id, server_id, path, content, size, is_dir) VALUES (?, ?, ?, ?, ?, ?)");
  files.forEach(f => ins.run(uuidv4(), serverId, f.path, f.content, f.content.length, f.is_dir));
}

function seedData() {
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(adminId, 'admin', 'admin@palto-network.io', passwordHash, 'admin');

    const userId = uuidv4();
    const userHash = bcrypt.hashSync('user123', 10);
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, 'player1', 'player@example.com', userHash, 'user');

    const helperId = uuidv4();
    const helperHash = bcrypt.hashSync('helper123', 10);
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(helperId, 'helper1', 'helper@palto-network.io', helperHash, 'helper');

    const nodeId = uuidv4();
    db.prepare(`INSERT INTO nodes (id, name, fqdn, port, memory, disk, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nodeId, 'Node EU-1', 'node1.palto-network.io', 8080, 32768, 512000, 800);

    const node2Id = uuidv4();
    db.prepare(`INSERT INTO nodes (id, name, fqdn, port, memory, disk, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(node2Id, 'Node US-1', 'node2.palto-network.io', 8080, 16384, 256000, 400);

    seedEggs(adminId, nodeId, userId);
  }

  // Seed panel settings
  const brandingExists = db.prepare("SELECT key FROM panel_settings WHERE key = 'panel_name'").get();
  if (!brandingExists) {
    const defaults: [string, string][] = [
      ['panel_name', 'Palto-Network'],
      ['panel_description', 'Herní server panel'],
      ['panel_color', '#7c3aed'],
      ['smtp_host', ''],
      ['smtp_port', '587'],
      ['smtp_user', ''],
      ['smtp_pass', ''],
      ['smtp_from', 'noreply@palto-network.io'],
    ];
    const ins = db.prepare("INSERT OR IGNORE INTO panel_settings (key, value) VALUES (?, ?)");
    defaults.forEach(([k, v]) => ins.run(k, v));
  }
}

function seedEggs(adminId: string, _nodeId: string, _userId: string) {
  const eggs = [
    {
      id: uuidv4(),
      name: 'Minecraft Java',
      description: 'Vanilla Minecraft Java Edition server with full customization support.',
      category: 'Minecraft',
      docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
      startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
      config_stop: 'stop',
      variables: JSON.stringify([
        { name: 'SERVER_JARFILE', description: 'Server jar file', default: 'server.jar', required: true },
        { name: 'MC_VERSION', description: 'Minecraft version', default: 'latest', required: false }
      ]),
      icon: 'pickaxe',
      color: '#22c55e'
    },
    {
      id: uuidv4(),
      name: 'Minecraft Bedrock',
      description: 'Official Minecraft Bedrock Dedicated Server for cross-platform play.',
      category: 'Minecraft',
      docker_image: 'ghcr.io/pterodactyl/yolks:debian',
      startup: './bedrock_server',
      config_stop: 'stop',
      variables: JSON.stringify([
        { name: 'LEVEL_NAME', description: 'World name', default: 'Bedrock level', required: false }
      ]),
      icon: 'box',
      color: '#10b981'
    },
    {
      id: uuidv4(),
      name: 'Rust',
      description: 'Rust dedicated server - the ultimate survival experience.',
      category: 'Survival',
      docker_image: 'ghcr.io/pterodactyl/games:rust',
      startup: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.hostname "{{HOSTNAME}}"',
      config_stop: 'quit',
      variables: JSON.stringify([
        { name: 'HOSTNAME', description: 'Server hostname', default: 'Palto-Network Rust', required: true },
        { name: 'MAX_PLAYERS', description: 'Maximum players', default: '100', required: false },
        { name: 'MAP_SEED', description: 'World seed', default: '12345', required: false }
      ]),
      icon: 'flame',
      color: '#f97316'
    },
    {
      id: uuidv4(),
      name: 'Counter-Strike 2',
      description: 'CS2 dedicated game server with full competitive support.',
      category: 'FPS',
      docker_image: 'ghcr.io/pterodactyl/games:source',
      startup: './game/bin/linuxsteamrt64/cs2 -dedicated -port {{SERVER_PORT}}',
      config_stop: 'quit',
      variables: JSON.stringify([
        { name: 'GAME_MAP', description: 'Default map', default: 'de_dust2', required: false },
        { name: 'MAX_PLAYERS', description: 'Max players', default: '10', required: false }
      ]),
      icon: 'crosshair',
      color: '#eab308'
    },
    {
      id: uuidv4(),
      name: 'Terraria',
      description: 'Terraria multiplayer server with TShock support.',
      category: 'Sandbox',
      docker_image: 'ghcr.io/pterodactyl/yolks:mono_6',
      startup: 'mono TerrariaServer.exe -port {{SERVER_PORT}} -maxplayers {{MAX_PLAYERS}}',
      config_stop: 'exit',
      variables: JSON.stringify([
        { name: 'MAX_PLAYERS', description: 'Max players', default: '8', required: false },
        { name: 'WORLD_NAME', description: 'World name', default: 'World', required: false }
      ]),
      icon: 'trees',
      color: '#84cc16'
    },
    {
      id: uuidv4(),
      name: 'ARK: Survival',
      description: 'ARK Survival Evolved dedicated server.',
      category: 'Survival',
      docker_image: 'ghcr.io/pterodactyl/games:ark',
      startup: './ShooterGame/Binaries/Linux/ShooterGameServer {{MAP}}?listen?SessionName={{SESSION_NAME}}',
      config_stop: 'saveworld',
      variables: JSON.stringify([
        { name: 'MAP', description: 'Map name', default: 'TheIsland', required: true },
        { name: 'SESSION_NAME', description: 'Session name', default: 'Palto-Network ARK', required: false }
      ]),
      icon: 'dinosaur',
      color: '#a855f7'
    },
    {
      id: uuidv4(),
      name: 'Node.js App',
      description: 'Generic Node.js application server.',
      category: 'Applications',
      docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_18',
      startup: 'node {{MAIN_FILE}}',
      config_stop: '^C',
      variables: JSON.stringify([
        { name: 'MAIN_FILE', description: 'Entry point file', default: 'index.js', required: true },
        { name: 'NODE_ENV', description: 'Node environment', default: 'production', required: false }
      ]),
      icon: 'code',
      color: '#06b6d4'
    },
    {
      id: uuidv4(),
      name: 'Python App',
      description: 'Generic Python 3 application server.',
      category: 'Applications',
      docker_image: 'ghcr.io/pterodactyl/yolks:python_3.11',
      startup: 'python {{MAIN_FILE}}',
      config_stop: '^C',
      variables: JSON.stringify([
        { name: 'MAIN_FILE', description: 'Entry point file', default: 'main.py', required: true }
      ]),
      icon: 'terminal',
      color: '#3b82f6'
    }
  ];

  const insertEgg = db.prepare(`
    INSERT INTO eggs (id, name, description, category, docker_image, startup, config_stop, variables, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  eggs.forEach(egg => {
    insertEgg.run(egg.id, egg.name, egg.description, egg.category, egg.docker_image, egg.startup, egg.config_stop, egg.variables, egg.icon, egg.color);
  });

  const firstNode = db.prepare('SELECT id FROM nodes LIMIT 1').get() as { id: string } | undefined;
  if (firstNode) {
    const servers = [
      { name: 'SurvivalCraft SMP', egg: 'Minecraft Java', status: 'running', memory: 4096, disk: 20480, cpu: 200, port: 25565 },
      { name: 'Creative World', egg: 'Minecraft Java', status: 'stopped', memory: 2048, disk: 10240, cpu: 100, port: 25566 },
      { name: 'Rust Main', egg: 'Rust', status: 'running', memory: 8192, disk: 30720, cpu: 300, port: 28015 },
      { name: 'CS2 Comp', egg: 'Counter-Strike 2', status: 'stopped', memory: 2048, disk: 15360, cpu: 150, port: 27015 },
    ];

    for (const s of servers) {
      const eggRow = db.prepare('SELECT id, name FROM eggs WHERE name = ?').get(s.egg) as { id: string; name: string } | undefined;
      if (eggRow) {
        const serverId = uuidv4();
        db.prepare(`
          INSERT INTO servers (id, name, owner_id, node_id, egg_id, status, memory, disk, cpu, port)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(serverId, s.name, adminId, firstNode.id, eggRow.id, s.status, s.memory, s.disk, s.cpu, s.port);
        seedServerFiles(serverId, eggRow.name);
      }
    }
  }
}
