// ============================================================
// Theater Sound Deck — Core Types
// ============================================================

/** File audio yang ada di Google Drive */
export interface DriveTrack {
  id: string            // Google Drive file ID
  name: string          // Nama tampilan (tanpa ekstensi)
  fileName: string      // Nama file asli (dengan ekstensi)
  mimeType: string
  size: number          // bytes
  modifiedTime: string  // ISO 8601
}

/** File audio yang sudah di-cache ke IndexedDB */
export interface CachedTrack {
  id: string            // == DriveTrack.id
  name: string
  fileName: string
  mimeType: string
  size: number
  blob: Blob
  cachedAt: Date
  objectUrl?: string    // dibuat saat diambil dari cache
}

/** Track yang sedang aktif diputar */
export interface ActiveTrack {
  id: string
  name: string
  volume: number        // 0.0 – 1.0 (volume track ini sendiri)
  gainNode?: GainNode   // untuk synth / Web Audio
  audioElement?: HTMLAudioElement
  stopFn: () => void
}

/** Status sinkronisasi per track */
export type SyncStatus = 'cached' | 'not_cached' | 'syncing' | 'error'

/** Progress sinkronisasi global */
export interface SyncProgress {
  total: number
  done: number
  isRunning: boolean
}
