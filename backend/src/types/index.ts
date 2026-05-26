export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'zakladatel' | 'spravca' | 'user';
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  memory: number;
  disk: number;
  cpu: number;
  status: 'online' | 'offline' | 'maintenance';
  created_at: string;
}

export interface Egg {
  id: string;
  name: string;
  description: string;
  category: string;
  docker_image: string;
  startup: string;
  config_files: string;
  config_startup: string;
  config_stop: string;
  variables: string;
  icon: string;
  color: string;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  node_id: string;
  egg_id: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'crashed' | 'installing';
  memory: number;
  disk: number;
  cpu: number;
  port: number;
  environment: string;
  created_at: string;
}

export interface ServerStats {
  server_id: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_rx: number;
  network_tx: number;
  uptime: number;
  timestamp: string;
}

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}
