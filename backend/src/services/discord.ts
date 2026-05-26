import https from 'https';
import { db } from '../db/database';

export function fireWebhook(event: string, data: Record<string, string>) {
  const webhooks = db.prepare("SELECT * FROM discord_webhooks WHERE enabled = 1").all() as any[];
  for (const wh of webhooks) {
    const events: string[] = JSON.parse(wh.events);
    if (!events.includes(event)) continue;

    const colors: Record<string, number> = {
      'server.start': 0x22c55e,
      'server.stop': 0x6b7280,
      'server.crash': 0xef4444,
      'server.install': 0x38bdf8,
      'user.create': 0xa78bfa,
    };

    const titles: Record<string, string> = {
      'server.start': '🟢 Server spuštěn',
      'server.stop': '🔴 Server zastaven',
      'server.crash': '💥 Server spadl',
      'server.install': '⚙️ Server instalován',
      'user.create': '👤 Nový uživatel',
    };

    const payload = JSON.stringify({
      embeds: [{
        title: titles[event] || event,
        color: colors[event] || 0x6366f1,
        fields: Object.entries(data).map(([name, value]) => ({ name, value, inline: true })),
        timestamp: new Date().toISOString(),
        footer: { text: 'Palto-Network Panel' }
      }]
    });

    try {
      const url = new URL(wh.url);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      };
      const req = https.request(options);
      req.on('error', () => {});
      req.write(payload);
      req.end();
    } catch {
      // ignore bad URLs
    }
  }
}
