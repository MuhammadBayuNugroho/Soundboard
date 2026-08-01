import Dexie, { type Table } from 'dexie'
import type { LocalTrack } from '../types'

// ============================================================
// IndexedDB Schema via Dexie
// Menyimpan file audio secara lokal untuk 100% offline playback
// ============================================================

class TheaterSoundDB extends Dexie {
  tracks!: Table<LocalTrack, string>

  constructor() {
    super('TheaterSoundDeckLocal')
    this.version(1).stores({
      tracks: 'id, name, addedAt'
    })
  }
}

export const db = new TheaterSoundDB()

// ──────────────────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────────────────

/** Simpan file audio baru ke database */
export async function saveLocalTrack(track: LocalTrack): Promise<void> {
  await db.tracks.put(track)
}

/** Ambil semua track yang tersimpan */
export async function getLocalTracks(): Promise<LocalTrack[]> {
  return db.tracks.orderBy('name').toArray()
}

/** Hapus track dari database */
export async function removeLocalTrack(id: string): Promise<void> {
  await db.tracks.delete(id)
}

/** Ubah nama track */
export async function renameLocalTrack(id: string, newName: string): Promise<void> {
  const track = await db.tracks.get(id)
  if (track) {
    track.name = newName
    await db.tracks.put(track)
  }
}

/** Hapus semua data (full reset) */
export async function clearAllLocalTracks(): Promise<void> {
  await db.tracks.clear()
}

/** Total ukuran storage terpakai (dalam bytes) */
export async function getStorageSize(): Promise<number> {
  const all = await db.tracks.toArray()
  return all.reduce((sum, t) => sum + t.size, 0)
}
