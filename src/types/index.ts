// ============================================================
// Theater Sound Deck — Core Types
// ============================================================

/** File audio yang disimpan secara lokal di IndexedDB */
export interface LocalTrack {
  id: string            // ID unik buatan lokal
  name: string          // Nama tampilan (tanpa ekstensi)
  fileName: string      // Nama file asli (dengan ekstensi)
  mimeType: string
  size: number          // bytes
  blob: Blob            // Data biner audio
  addedAt: Date
}

/** Track yang sedang aktif diputar */
export interface ActiveTrack {
  id: string
  name: string
  volume: number        // 0.0 – 1.0 (volume track ini sendiri)
  audioElement?: HTMLAudioElement
  stopFn: () => void
}
