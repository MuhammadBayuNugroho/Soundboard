export interface Audio {
  id: string;
  drive_id: string | null;
  nama: string;
  kategori: 'Opening' | 'Mars' | 'Sholawat' | 'Efek' | 'Closing' | 'Instrument';
  local_path: string;
  volume: number;
  fade: number; // 0 or 1 for boolean representation in SQLite
  favorite: number; // 0 or 1
  shortcut: string | null;
  checksum: string | null;
  modified_time: string | null;
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface Log {
  id: number;
  timestamp: string;
  action: string;
  details: string | null;
}

export interface DeviceClient {
  socketId: string;
  role: 'player' | 'remote';
  userAgent: string;
  ipAddress: string;
  connectedAt: string;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  progress: number;
  message: string;
  totalFiles: number;
  processedFiles: number;
}
