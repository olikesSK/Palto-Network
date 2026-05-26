import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';

// ─── Config ───────────────────────────────────────────────────────────────────

export const SERVER_DATA_ROOT = process.env.SERVER_DATA_PATH || '/opt/palto-servers';
export const BACKUP_DATA_ROOT = process.env.BACKUP_DATA_PATH || '/opt/palto-backups';

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

// ─── Egg → Docker image mapping ───────────────────────────────────────────────

interface EggCfg {
  image: string;
  dataPath: string;
  extraEnv: string[];
  udp?: boolean;
}

const EGG_MAP: [string, EggCfg][] = [
  ['minecraft java',    { image: 'itzg/minecraft-server:latest',         dataPath: '/data',                     extraEnv: ['EULA=TRUE', 'TYPE=VANILLA'] }],
  ['minecraft bedrock', { image: 'itzg/minecraft-bedrock-server:latest', dataPath: '/data',                     extraEnv: ['EULA=TRUE'], udp: true }],
  ['paper',             { image: 'itzg/minecraft-server:latest',         dataPath: '/data',                     extraEnv: ['EULA=TRUE', 'TYPE=PAPER'] }],
  ['rust',              { image: 'didstopia/rust-server:latest',         dataPath: '/steamcmd/rust',            extraEnv: [], udp: true }],
  ['counter-strike',    { image: 'cm2network/cs2:latest',                dataPath: '/home/steam/cs2-dedicated', extraEnv: [], udp: true }],
  ['cs2',               { image: 'cm2network/cs2:latest',                dataPath: '/home/steam/cs2-dedicated', extraEnv: [], udp: true }],
  ['terraria',          { image: 'ryshe/terraria:latest',                dataPath: '/world',                    extraEnv: [] }],
  ['ark',               { image: 'acekorneya/asa-server:latest',         dataPath: '/ark',                      extraEnv: [], udp: true }],
  ['node.js',           { image: 'node:20-alpine',                       dataPath: '/app',                      extraEnv: [] }],
  ['python',            { image: 'python:3.12-slim',                     dataPath: '/app',                      extraEnv: [] }],
];

function getEggCfg(eggName: string): EggCfg {
  const lower = eggName.toLowerCase();
  for (const [key, cfg] of EGG_MAP) {
    if (lower.includes(key)) return cfg;
  }
  return { image: 'alpine:latest', dataPath: '/data', extraEnv: [] };
}

// ─── State ────────────────────────────────────────────────────────────────────

const stdinStreams = new Map<string, NodeJS.WritableStream>();
let ioEmitter: ((id: string, line: string, type: string) => void) | null = null;

export function setIoEmitter(fn: typeof ioEmitter) { ioEmitter = fn; }

function log(serverId: string, line: string, type = 'output') {
  try {
    if (ioEmitter) ioEmitter(serverId, line, type);
    db.prepare('INSERT INTO server_logs (server_id, message, type) VALUES (?, ?, ?)').run(serverId, line, type);
  } catch {}
}

// ─── Public API (same signatures as old bash-based process.ts) ───────────────

export function getServerDir(id: string): string {
  const dir = path.join(SERVER_DATA_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Fire-and-forget — returns true immediately, starts container in background */
export function startServer(serverId: string): boolean {
  startAsync(serverId).catch(err => {
    log(serverId, `[Panel] Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
  });
  return true;
}

export function stopServer(serverId: string, force = false): boolean {
  stopAsync(serverId, force).catch(() => {});
  return true;
}

export function sendCommand(serverId: string, command: string): boolean {
  const stdin = stdinStreams.get(serverId);
  if (!stdin) return false;
  try { stdin.write(command + '\n'); return true; } catch { return false; }
}

export function isRunning(serverId: string): boolean {
  const row = db.prepare("SELECT status FROM servers WHERE id = ?").get(serverId) as { status: string } | undefined;
  return row?.status === 'running';
}

export async function getStats(serverId: string): Promise<{ cpu: number; memory: number; uptime: number } | null> {
  const row = db.prepare('SELECT container_id FROM servers WHERE id = ?').get(serverId) as { container_id: string | null } | undefined;
  if (!row?.container_id) return null;
  try {
    const stats = await docker.getContainer(row.container_id).stats({ stream: false }) as DockerStats;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta  = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const ncpu = stats.cpu_stats.online_cpus ?? 1;
    const cpu = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
    const cache = stats.memory_stats.stats?.cache ?? 0;
    const memUsed = stats.memory_stats.usage - cache;
    const memPct = stats.memory_stats.limit > 0 ? (memUsed / stats.memory_stats.limit) * 100 : 0;
    return { cpu: clamp(cpu), memory: clamp(memPct), uptime: 0 };
  } catch { return null; }
}

export function getUptime(_id: string): number { return 0; }

// ─── Docker helpers ───────────────────────────────────────────────────────────

async function startAsync(serverId: string): Promise<void> {
  const server = db.prepare(`
    SELECT s.*, e.name as egg_name
    FROM servers s JOIN eggs e ON s.egg_id = e.id WHERE s.id = ?
  `).get(serverId) as ServerRow | undefined;
  if (!server) return;

  const cfg = getEggCfg(server.egg_name);
  const serverDir = getServerDir(serverId);
  const name = `palto-${serverId.replace(/-/g, '').slice(0, 16)}`;
  const userEnv = parseJson<Record<string, string>>(server.environment, {});

  // Build env list
  const envList: string[] = [
    ...cfg.extraEnv,
    `SERVER_PORT=${server.port}`,
    ...Object.entries(userEnv).map(([k, v]) => `${k}=${v}`),
  ];
  if (cfg.image.startsWith('itzg/minecraft')) {
    envList.push(`MEMORY=${Math.floor(server.memory * 0.85)}M`);
    if (userEnv.MC_VERSION) envList.push(`VERSION=${userEnv.MC_VERSION}`);
  }

  // Remove stale container
  try {
    const old = docker.getContainer(name);
    const info = await old.inspect();
    if (info.State.Running) await old.stop({ t: 5 }).catch(() => {});
    await old.remove({ force: true });
  } catch {}

  // Pull image (shows progress in console)
  log(serverId, `[Panel] Pulling ${cfg.image} — first run may take a few minutes...`, 'system');
  try {
    await pullImage(cfg.image, status => log(serverId, `[Pull] ${status}`, 'system'));
    log(serverId, '[Panel] Image ready.', 'system');
  } catch (e) {
    log(serverId, `[Panel] Pull warning: ${e instanceof Error ? e.message : String(e)}`, 'system');
  }

  // Port bindings
  const proto = cfg.udp ? 'udp' : 'tcp';
  const portKey = `${server.port}/${proto}`;
  const exposedPorts: Record<string, object> = { [portKey]: {} };
  const portBindings: Record<string, { HostPort: string }[]> = { [portKey]: [{ HostPort: String(server.port) }] };

  try {
    const container = await docker.createContainer({
      name,
      Image: cfg.image,
      Env: envList,
      AttachStdin: true, AttachStdout: true, AttachStderr: true,
      OpenStdin: true, StdinOnce: false, Tty: false,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Memory:    server.memory * 1024 * 1024,
        MemorySwap: server.memory * 2 * 1024 * 1024,
        NanoCpus:  server.cpu > 0 ? server.cpu * 10_000_000 : 0,
        PortBindings: portBindings,
        Binds: [`${serverDir}:${cfg.dataPath}`],
        RestartPolicy: { Name: 'no' },
      },
    });

    await container.start();

    db.prepare("UPDATE servers SET status = 'running', container_id = ? WHERE id = ?")
      .run(container.id, serverId);
    log(serverId, `[Panel] Container started (${container.id.slice(0, 12)})`, 'system');

    // Attach stdin for command sending
    container.attach({ stream: true, stdin: true, stdout: false, stderr: false },
      (err: Error | null, stream?: NodeJS.ReadWriteStream) => {
        if (!err && stream) stdinStreams.set(serverId, stream);
      }
    );

    // Stream logs → socket.io + DB
    container.logs({ follow: true, stdout: true, stderr: true, tail: 0 },
      (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err || !stream) return;
        let buf = '';
        stream.on('data', (chunk: Buffer) => {
          // Strip Docker 8-byte multiplex headers
          let offset = 0;
          while (offset + 8 <= chunk.length) {
            const len = chunk.readUInt32BE(offset + 4);
            if (offset + 8 + len > chunk.length) break;
            buf += chunk.slice(offset + 8, offset + 8 + len).toString('utf8');
            offset += 8 + len;
          }
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          lines.filter(l => l.trim()).forEach(l => log(serverId, l, 'output'));
        });
        stream.on('end', () => {
          stdinStreams.delete(serverId);
          const row = db.prepare("SELECT status FROM servers WHERE id = ?").get(serverId) as { status: string } | undefined;
          if (row && row.status !== 'stopped') {
            db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
            log(serverId, '[Panel] Container stopped.', 'system');
          }
        });
      }
    );

  } catch (e: unknown) {
    log(serverId, `[Panel Error] ${e instanceof Error ? e.message : String(e)}`, 'error');
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
  }
}

async function stopAsync(serverId: string, force: boolean): Promise<void> {
  const row = db.prepare('SELECT container_id FROM servers WHERE id = ?').get(serverId) as { container_id: string | null } | undefined;
  db.prepare("UPDATE servers SET status = 'stopping' WHERE id = ?").run(serverId);
  stdinStreams.delete(serverId);
  if (row?.container_id) {
    try {
      const c = docker.getContainer(row.container_id);
      if (force) await c.kill();
      else await c.stop({ t: 15 });
    } catch {}
  }
  db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
}

async function pullImage(image: string, onProgress: (s: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) { resolve(); return; }
      (docker.modem as { followProgress: (s: NodeJS.ReadableStream, done: (e: Error | null) => void, progress: (e: { status?: string; progress?: string }) => void) => void })
        .followProgress(
          stream,
          (e) => (e ? reject(e) : resolve()),
          (ev) => { if (ev.status) onProgress(ev.progress ? `${ev.status} ${ev.progress}` : ev.status); }
        );
    });
  });
}

/** Called from server creation to pre-pull the image */
export async function pullServerImage(eggName: string, serverId: string): Promise<void> {
  const cfg = getEggCfg(eggName);
  log(serverId, `[Panel] Installing: pulling ${cfg.image}...`, 'system');
  try {
    await pullImage(cfg.image, s => log(serverId, `[Pull] ${s}`, 'system'));
    log(serverId, '[Panel] Installation complete — server is ready to start.', 'system');
  } catch (e) {
    log(serverId, `[Panel] Pull failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
  db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(serverId);
}

/** Check whether Docker daemon is reachable */
export async function checkDocker(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const info = await docker.version();
    return { ok: true, version: info.Version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServerRow {
  id: string; name: string; egg_name: string; port: number;
  memory: number; cpu: number; environment: string; container_id?: string;
}

interface DockerStats {
  cpu_stats:    { cpu_usage: { total_usage: number }; system_cpu_usage: number; online_cpus?: number };
  precpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number };
  memory_stats: { usage: number; limit: number; stats?: { cache?: number } };
}

function clamp(v: number): number { return Math.min(100, Math.max(0, v)); }
function parseJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Graceful cleanup
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());
