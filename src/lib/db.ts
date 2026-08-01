import Dexie, { type Table } from 'dexie'
import type { CachedTrack } from '../types'

// ============================================================
// IndexedDB Schema via Dexie
// Menyimpan blob audio lokal untuk zero-latency playback
// ============================================================

interface CachedTrackRecord {
  id: string        // Primary key = Google Drive file ID
  name: string
  fileName: string
  mimeType: string
  size: number
  blob: Blob
  cachedAt: Date
}

class TheaterSoundDB extends Dexie {
  tracks!: Table<CachedTrackRecord, string>

  constructor() {
    super('TheaterSoundDeck')
    this.version(1).stores({
      tracks: 'id, name, cachedAt'
    })
  }
}

export const db = new TheaterSoundDB()

// ──────────────────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────────────────

/** Simpan / update blob audio ke cache lokal */
export async function cacheTrack(track: Omit<CachedTrackRecord, 'cachedAt'>): Promise<void> {
  await db.tracks.put({ ...track, cachedAt: new Date() })
}

/** Ambil track dari cache — returns null jika tidak ada */
export async function getCachedTrack(id: string): Promise<CachedTrack | null> {
  const record = await db.tracks.get(id)
  if (!record) return null
  return {
    ...record,
    objectUrl: undefined,
  }
}

/** List semua ID track yang sudah di-cache */
export async function getCachedTrackIds(): Promise<Set<string>> {
  const ids = await db.tracks.toCollection().primaryKeys()
  return new Set(ids as string[])
}

/** Hapus blob track dari cache */
export async function removeCachedTrack(id: string): Promise<void> {
  await db.tracks.delete(id)
}

/** Hapus semua cache (full reset) */
export async function clearAllCache(): Promise<void> {
  await db.tracks.clear()
}

/** Total ukuran cache dalam bytes */
export async function getCacheSize(): Promise<number> {
  const all = await db.tracks.toArray()
  return all.reduce((sum, t) => sum + t.size, 0)
}
