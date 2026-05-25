import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '../../data/wizz-craft.db');

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
  `);

  seedData();
}

function seedData() {
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(adminId, 'admin', 'admin@wizz-craft.io', passwordHash, 'admin');

    const userId = uuidv4();
    const userHash = bcrypt.hashSync('user123', 10);
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, 'player1', 'player@example.com', userHash, 'user');

    const nodeId = uuidv4();
    db.prepare(`INSERT INTO nodes (id, name, fqdn, port, memory, disk, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nodeId, 'Node EU-1', 'node1.wizz-craft.io', 8080, 32768, 512000, 800);

    const node2Id = uuidv4();
    db.prepare(`INSERT INTO nodes (id, name, fqdn, port, memory, disk, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(node2Id, 'Node US-1', 'node2.wizz-craft.io', 8080, 16384, 256000, 400);

    seedEggs(adminId, nodeId, userId);
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
        { name: 'HOSTNAME', description: 'Server hostname', default: 'Wizz-Craft Rust', required: true },
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
        { name: 'SESSION_NAME', description: 'Session name', default: 'Wizz-Craft ARK', required: false }
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
      const eggRow = db.prepare('SELECT id FROM eggs WHERE name = ?').get(s.egg) as { id: string } | undefined;
      if (eggRow) {
        db.prepare(`
          INSERT INTO servers (id, name, owner_id, node_id, egg_id, status, memory, disk, cpu, port)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), s.name, adminId, firstNode.id, eggRow.id, s.status, s.memory, s.disk, s.cpu, s.port);
      }
    }
  }
}
