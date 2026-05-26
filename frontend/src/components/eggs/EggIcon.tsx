import {
  Server, Code, Terminal, Flame, Crosshair, Trees, Box, Pickaxe, Cpu, Globe, Database, Zap
} from 'lucide-react';

const icons: Record<string, React.ElementType> = {
  server: Server, code: Code, terminal: Terminal, flame: Flame,
  crosshair: Crosshair, trees: Trees, box: Box, pickaxe: Pickaxe,
  cpu: Cpu, globe: Globe, database: Database, zap: Zap,
  dinosaur: Zap,
};

export default function EggIcon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const Icon = icons[name] ?? Server;
  return <Icon size={size} style={{ color: color || 'currentColor' }} />;
}
