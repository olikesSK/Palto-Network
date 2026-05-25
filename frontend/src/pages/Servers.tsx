import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Server, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import api from '../api/client';
import { Server as ServerType } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import EggIcon from '../components/eggs/EggIcon';
import CreateServerModal from '../components/servers/CreateServerModal';

export default function Servers() {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchServers = () => {
    setLoading(true);
    api.get('/servers').then(r => { setServers(r.data); setLoading(false); });
  };

  useEffect(() => { fetchServers(); }, []);

  const filtered = servers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.egg_name.toLowerCase().includes(search.toLowerCase()) ||
    s.node_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
            placeholder="Search servers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setShowCreate(true)} className="glass-btn glass-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <Plus size={16} /> New Server
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="liquid-card h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="liquid-card p-16 text-center">
          <Server size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium text-white">No servers found</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Create your first server to get started</p>
          <button onClick={() => setShowCreate(true)} className="glass-btn glass-btn-primary px-5 py-2.5 text-sm mt-4">
            Create Server
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((server, i) => (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/servers/${server.id}`} className="liquid-card block p-5 h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${server.color}22`, border: `1px solid ${server.color}44` }}
                  >
                    <EggIcon name={server.icon} size={20} color={server.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{server.name}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {server.egg_name} • {server.node_name}
                    </div>
                  </div>
                  <StatusBadge status={server.status} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: MemoryStick, label: 'RAM', value: server.memory >= 1024 ? `${server.memory/1024}GB` : `${server.memory}MB`, color: '#a78bfa' },
                    { icon: HardDrive, label: 'Disk', value: server.disk >= 1024 ? `${(server.disk/1024).toFixed(0)}GB` : `${server.disk}MB`, color: '#38bdf8' },
                    { icon: Cpu, label: 'CPU', value: `${server.cpu}%`, color: '#f472b6' },
                  ].map(r => (
                    <div key={r.label} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <r.icon size={12} style={{ color: r.color }} className="mb-1" />
                      <div className="text-xs font-medium text-white">{r.value}</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span>Port: {server.port}</span>
                  <span>{server.owner_name}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} onCreated={fetchServers} />}
    </div>
  );
}
