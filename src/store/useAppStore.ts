import { create } from 'zustand'
import type { LocalTrack, ActiveTrack } from '../types'
import { getLocalTracks } from '../lib/db'

// ============================================================
// Zustand Global Store (Simplified for Local Storage)
// ============================================================

interface AppState {
  // ── Auth ──────────────────────────────────────────────
  isLoggedIn: boolean
  setLoggedIn: (v: boolean) => void

  // ── Tracks (IndexedDB Local) ──────────────────────────
  tracks: LocalTrack[]
  setTracks: (tracks: LocalTrack[]) => void
  loadTracksFromDB: () => Promise<void>
  addTrack: (track: LocalTrack) => void
  removeTrack: (id: string) => void
  renameTrackState: (id: string, name: string) => void

  // ── Active Playback ───────────────────────────────────
  activeTracks: Map<string, ActiveTrack>
  registerTrack: (track: ActiveTrack) => void
  unregisterTrack: (id: string) => void
  stopAllTracks: () => void
  setTrackVolume: (id: string, volume: number) => void
  masterVolume: number
  setMasterVolume: (v: number) => void

  // ── UI State ──────────────────────────────────────────
  isLocked: boolean            // true = mode pentas (lock), false = mode edit
  toggleLock: () => void
  isLoadingTracks: boolean
  setIsLoadingTracks: (v: boolean) => void
  isUploadModalOpen: boolean
  setUploadModalOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────
  isLoggedIn: localStorage.getItem('soundboard_logged_in') === 'true',
  setLoggedIn: (v) => {
    localStorage.setItem('soundboard_logged_in', String(v))
    set({ isLoggedIn: v })
  },

  // ── Tracks ────────────────────────────────────────────
  tracks: [],
  setTracks: (tracks) => set({ tracks }),

  loadTracksFromDB: async () => {
    set({ isLoadingTracks: true })
    try {
      const list = await getLocalTracks()
      set({ tracks: list })
    } catch (err) {
      console.error('Gagal memuat list audio dari DB:', err)
    } finally {
      set({ isLoadingTracks: false })
    }
  },

  addTrack: (track) =>
    set((s) => {
      // Urutkan berdasarkan nama agar selalu rapi
      const nextTracks = [...s.tracks, track].sort((a, b) => a.name.localeCompare(b.name))
      return { tracks: nextTracks }
    }),

  removeTrack: (id) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),

  renameTrackState: (id, name) =>
    set((s) => ({
      tracks: s.tracks
        .map((t) => (t.id === id ? { ...t, name } : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),

  // ── Active Playback ───────────────────────────────────
  activeTracks: new Map(),

  registerTrack: (track) =>
    set((s) => {
      const next = new Map(s.activeTracks)
      next.set(track.id, track)
      return { activeTracks: next }
    }),

  unregisterTrack: (id) =>
    set((s) => {
      const next = new Map(s.activeTracks)
      next.delete(id)
      return { activeTracks: next }
    }),

  stopAllTracks: () => {
    const { activeTracks } = get()
    activeTracks.forEach((t) => {
      try { t.stopFn() } catch (_) {}
    })
    set({ activeTracks: new Map() })
  },

  setTrackVolume: (id, volume) => {
    const { activeTracks, masterVolume } = get()
    const track = activeTracks.get(id)
    if (!track) return

    const effective = volume * masterVolume

    if (track.audioElement) {
      track.audioElement.volume = Math.min(1, effective)
    }

    // Update volume di state
    const next = new Map(activeTracks)
    next.set(id, { ...track, volume })
    set({ activeTracks: next })
  },

  masterVolume: 1.0,

  setMasterVolume: (v) => {
    set({ masterVolume: v })
    // Terapkan ke semua track aktif
    const { activeTracks } = get()
    activeTracks.forEach((track) => {
      const effective = track.volume * v
      if (track.audioElement) {
        track.audioElement.volume = Math.min(1, effective)
      }
    })
  },

  // ── UI State ──────────────────────────────────────────
  isLocked: false,
  toggleLock: () => set((s) => ({ isLocked: !s.isLocked })),

  isLoadingTracks: false,
  setIsLoadingTracks: (v) => set({ isLoadingTracks: v }),

  isUploadModalOpen: false,
  setUploadModalOpen: (v) => set({ isUploadModalOpen: v }),
}))
