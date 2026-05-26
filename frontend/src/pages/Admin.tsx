import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Server, Users, Network, Egg, Activity } from 'lucide-react';
import api from '../api/client';
import { GlobalStats } from '../types';

export default function Admin() {
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useEffect(() => { api.get('/stats').then(r => setStats(r.data)); }, []);

  const cards = [
    { icon: Server, label: 'Total Servers', value: stats?.totalServers, color: '#a78bfa' },
    { icon: Activity, label: 'Running', value: stats?.runningServers, color: '#22c55e' },
    { icon: Users, label: 'Users', value: stats?.totalUsers, color: '#38bdf8' },
    { icon: Network, label: 'Online Nodes', value: `${stats?.onlineNodes}/${stats?.totalNodes}`, color: '#f472b6' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="liquid-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <ShieldCheck size={18} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Admin Overview</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>System-wide statistics and management</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4" style={{ background: `${c.color}12`, border: `1px solid ${c.color}30` }}>
              <c.icon size={18} style={{ color: c.color }} className="mb-2" />
              <div className="text-2xl font-bold text-white">{c.value ?? '—'}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{c.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          { icon: Server, title: 'Servers', desc: 'Manage all game servers', href: '/servers', color: '#a78bfa' },
          { icon: Egg, title: 'Egg Engines', desc: 'Configure server templates', href: '/eggs', color: '#f472b6' },
          { icon: Network, title: 'Nodes', desc: 'Monitor infrastructure', href: '/nodes', color: '#38bdf8' },
          { icon: Users, title: 'Users', desc: 'Manage user accounts', href: '/users', color: '#22c55e' },
        ].map((card, i) => (
          <motion.a key={card.title} href={card.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
            className="liquid-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${card.color}22`, border: `1px solid ${card.color}44` }}>
              <card.icon size={20} style={{ color: card.color }} />
            </div>
            <div>
              <div className="font-semibold text-white">{card.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.desc}</div>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
