import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import pidusage from 'pidusage';
import { db } from '../db/database';

interface ManagedProcess {
  proc: ChildProcessWithoutNullStreams;
  serverId: string;
  startedAt: number;
}

const processes = new Map<string, ManagedProcess>();
let ioEmitter: ((serverId: string, line: string, type: string) => void) | null = null;

export function setIoEmitter(emitter: (serverId: string, line: string, type: string) => void) {
  ioEmitter = emitter;
}

function getScriptPath(eggName: string): string {
  const scriptsDir = path.join(__dirname, '../scripts');
  const nameLower = eggName.toLowerCase();
  if (nameLower.includes('minecraft') || nameLower.includes('paper') || nameLower.includes('spigot')) {
    return path.join(scriptsDir, 'minecraft.sh');
  }
  if (nameLower.includes('rust')) {
    return path.join(scriptsDir, 'rust.sh');
  }
  if (nameLower.includes('cs2') || nameLower.includes('counter-strike') || nameLower.includes('csgo')) {
    return path.join(scriptsDir, 'cs2.sh');
  }
  return path.join(scriptsDir, 'generic.sh');
}

function getServerDir(serverId: string): string {
  const dir = path.join('/tmp/wizz-servers', serverId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function log(serverId: string, line: string, type: string = 'output') {
  if (ioEmitter) ioEmitter(serverId, line, type);
  db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(serverId, line, type);
}

export function startServer(serverId: string): boolean {
  if (processes.has(serverId)) return false;

  const server = db.prepare(`
    SELECT s.*, e.name as egg_name FROM servers s JOIN eggs e ON s.egg_id = e.id WHERE s.id = ?
  `).get(serverId) as { name: string; egg_name: string; port: number; memory: number } | undefined;

  if (!server) return false;

  const scriptPath = getScriptPath(server.egg_name);
  if (!fs.existsSync(scriptPath)) return false;

  const serverDir = getServerDir(serverId);

  const proc = spawn('bash', [scriptPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      SERVER_NAME: server.name,
      SERVER_PORT: String(server.port || 25565),
      SERVER_MEMORY: String(server.memory || 1024),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  processes.set(serverId, { proc, serverId, startedAt: Date.now() });
  db.prepare("UPDATE servers SET status = 'running' WHERE id = ?").run(serverId);

  proc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => log(serverId, line, 'output'));
  });

  proc.stderr.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => log(serverId, line, 'error'));
  });

  proc.on('close', (code) => {
    processes.delete(serverId);
    const exitLine = `[Process exited with code ${code ?? 0}]`;
    log(serverId, exitLine, 'system');
    const current = db.prepare("SELECT status FROM servers WHERE id = ?").get(serverId) as { status: string } | undefined;
    if (current && current.status !== 'stopped') {
      db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
    }
  });

  proc.on('error', (err) => {
    log(serverId, `[Process error: ${err.message}]`, 'error');
    processes.delete(serverId);
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
  });

  return true;
}

export function stopServer(serverId: string, kill = false): boolean {
  const managed = processes.get(serverId);
  if (!managed) return false;

  db.prepare("UPDATE servers SET status = 'stopping' WHERE id = ?").run(serverId);

  if (kill) {
    managed.proc.kill('SIGKILL');
  } else {
    // Send stop command via stdin, fall back to SIGTERM after 10s
    try {
      managed.proc.stdin.write('stop\n');
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (processes.has(serverId)) {
        managed.proc.kill('SIGTERM');
      }
    }, 10000);
  }

  return true;
}

export function sendCommand(serverId: string, command: string): boolean {
  const managed = processes.get(serverId);
  if (!managed) return false;
  try {
    managed.proc.stdin.write(command + '\n');
    return true;
  } catch {
    return false;
  }
}

export function isRunning(serverId: string): boolean {
  return processes.has(serverId);
}

export async function getStats(serverId: string): Promise<{
  cpu: number; memory: number; uptime: number;
} | null> {
  const managed = processes.get(serverId);
  if (!managed) return null;

  try {
    const stats = await pidusage(managed.proc.pid!);
    return {
      cpu: Math.min(stats.cpu, 100),
      memory: stats.memory,
      uptime: Math.floor((Date.now() - managed.startedAt) / 1000),
    };
  } catch {
    return null;
  }
}

export function getUptime(serverId: string): number {
  const managed = processes.get(serverId);
  if (!managed) return 0;
  return Math.floor((Date.now() - managed.startedAt) / 1000);
}

// On process exit, clean up all child processes
process.on('exit', () => {
  processes.forEach(({ proc }) => {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
  });
});

process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());
