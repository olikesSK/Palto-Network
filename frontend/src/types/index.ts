export interface User {
  id: string;
  username: string;
  email: string;
  role: 'zakladatel' | 'spravca' | 'user';
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
  allocatedMemory: number;
  allocatedDisk: number;
  totalMemory: number;
  totalDisk: number;
}

export interface DiscordWebhook {
  id: string;
  name: string;
  url: string;
  events: string;
  enabled: number;
  created_at: string;
}

export interface ChatMessage {
  id?: number;
  user_id: string;
  username: string;
  role: string;
  channel: string;
  message: string;
  created_at: string;
}

export interface OnlineUser {
  id: string;
  username: string;
  role: string;
  socketId: string;
}

export interface SubUser {
  id: string;
  server_id: string;
  user_id: string;
  username: string;
  email: string;
  role: string;
  permissions: string;
  created_at: string;
}
