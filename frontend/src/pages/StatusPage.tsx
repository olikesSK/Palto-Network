import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Server, RefreshCw, Sparkles } from 'lucide-react';

interface NodeStatus {
  id: string;
  name: string;
  fqdn: string;
  status: string;
  servers: number;
  running: number;
}

interface StatusData {
  panel: string;
  status: 'operational' | 'degraded' | 'outage';
  nodes: NodeStatus[];
  stats: {
    totalServers: number;
    runningServers: number;
    totalNodes: number;
    onlineNodes: number;
  };
  updated: string;
}

const statusConfig = {
  operational: {
    icon: CheckCircle,
    label: 'Všechny systémy funkční',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.25)',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degradovaný výkon',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
  },
  outage: {
    icon: XCircle,
    label: 'Výpadek systému',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
  },
};

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    try {
      const res = await fetch('/api/status');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const status = data?.status || 'operational';
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: '#050510' }}
    >
      {/* Background orbs */}
      <div className="fixed w-[700px] h-[700px] opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', top: '-200px', left: '-200px' }} />
      <div className="fixed w-[600px] h-[600px] opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)', bottom: '-150px', right: '0' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)' }}
            >
              <Sparkles size={22} className="text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Wizz-Craft</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Status Page</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Overall status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4 p-6 rounded-2xl mb-8"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <StatusIcon size={36} style={{ color: cfg.color }} />
              <div>
                <h2 className="text-xl font-bold text-white">{cfg.label}</h2>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Aktualizováno: {new Date(lastRefresh).toLocaleString('cs-CZ')}
                </p>
              </div>
              <button
                onClick={load}
                className="ml-auto p-2 rounded-xl transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                title="Obnovit"
              >
                <RefreshCw size={16} />
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              {data && [
                { label: 'Celkem serverů', value: data.stats.totalServers },
                { label: 'Běžící servery', value: data.stats.runningServers, color: '#22c55e' },
                { label: 'Celkem nodů', value: data.stats.totalNodes },
                { label: 'Online nody', value: data.stats.onlineNodes, color: '#22c55e' },
              ].map((s, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
                >
                  <div className="text-3xl font-bold" style={{ color: s.color || 'white' }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                </div>
              ))}
            </motion.div>

            {/* Nodes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>NODY</h3>
              <div className="space-y-2">
                {data?.nodes.map(node => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-4 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: node.status === 'online' ? '#22c55e' : node.status === 'maintenance' ? '#f59e0b' : '#ef4444' }}
                      />
                      <div>
                        <div className="font-medium text-white">{node.name}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{node.fqdn}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ color: '#22c55e' }}>{node.running}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>běžících</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{node.servers}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>celkem</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Server size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: node.status === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: node.status === 'online' ? '#22c55e' : '#f87171',
                          }}
                        >
                          {node.status === 'online' ? 'Online' : node.status === 'maintenance' ? 'Údržba' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-xs mt-10"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Wizz-Craft Game Panel • Auto-refresh každých 30 sekund
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}
