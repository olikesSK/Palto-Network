export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  server_count?: number;
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
  used_memory: number;
  used_disk: number;
  used_cpu: number;
  server_count: number;
  created_at: string;
}

export interface EggVariable {
  name: string;
  description: string;
  default: string;
  required: boolean;
}

export interface Egg {
  id: string;
  name: string;
  description: string;
  category: string;
  docker_image: string;
  startup: string;
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
  owner_name: string;
  node_id: string;
  node_name: string;
  egg_id: string;
  egg_name: string;
  icon: string;
  color: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'crashed' | 'installing';
  memory: number;
  disk: number;
  cpu: number;
  port: number;
  environment: string;
  startup?: string;
  variables?: string;
  created_at: string;
}

export interface ServerStats {
  cpu: number;
  memory: number;
  memory_limit: number;
  disk: number;
  disk_limit: number;
  network_rx: number;
  network_tx: number;
  uptime: number;
}

export interface GlobalStats {
  totalServers: number;
  runningServers: number;
  totalUsers: number;
  totalNodes: number;
  onlineNodes: number;
}
