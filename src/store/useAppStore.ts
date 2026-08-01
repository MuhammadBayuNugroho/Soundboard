import { create } from 'zustand'
import type { DriveTrack, ActiveTrack, SyncProgress } from '../types'

// ============================================================
// Zustand Global Store
// ============================================================

interface AppState {
  // ── Auth ──────────────────────────────────────────────
  isLoggedIn: boolean
  accessToken: string | null
  userName: string
  userAvatar: string
  setAuth: (token: string, name: string, avatar: string) => void
  clearAuth: () => void

  // ── Tracks (dari Google Drive) ────────────────────────
  driveTracks: DriveTrack[]
  setDriveTracks: (tracks: DriveTrack[]) => void
  addDriveTrack: (track: DriveTrack) => void
  removeDriveTrack: (id: string) => void
  updateDriveTrackName: (id: string, name: string) => void

  // ── Cache status ──────────────────────────────────────
  cachedTrackIds: Set<string>
  setCachedTrackIds: (ids: Set<string>) => void
  markAsCached: (id: string) => void
  removeFromCache: (id: string) => void

  // ── Active Playback ───────────────────────────────────
  activeTracks: Map<string, ActiveTrack>
  registerTrack: (track: ActiveTrack) => void
  unregisterTrack: (id: string) => void
  stopAllTracks: () => void
  setTrackVolume: (id: string, volume: number) => void
  masterVolume: number
  setMasterVolume: (v: number) => void

  // ── UI State ──────────────────────────────────────────
  isLocked: boolean            // true = mode pentas, false = mode edit
  toggleLock: () => void
  syncProgress: SyncProgress
  setSyncProgress: (p: Partial<SyncProgress>) => void
  isLoadingTracks: boolean
  setIsLoadingTracks: (v: boolean) => void
  isUploadModalOpen: boolean
  setUploadModalOpen: (v: boolean) => void
  renamingTrackId: string | null
  setRenamingTrackId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────
  isLoggedIn: false,
  accessToken: null,
  userName: '',
  userAvatar: '',

  setAuth: (token, name, avatar) =>
    set({ isLoggedIn: true, accessToken: token, userName: name, userAvatar: avatar }),

  clearAuth: () =>
    set({
      isLoggedIn: false,
      accessToken: null,
      userName: '',
      userAvatar: '',
      driveTracks: [],
      activeTracks: new Map(),
    }),

  // ── Tracks ────────────────────────────────────────────
  driveTracks: [],
  setDriveTracks: (tracks) => set({ driveTracks: tracks }),

  addDriveTrack: (track) =>
    set((s) => ({ driveTracks: [...s.driveTracks, track] })),

  removeDriveTrack: (id) =>
    set((s) => ({ driveTracks: s.driveTracks.filter((t) => t.id !== id) })),

  updateDriveTrackName: (id, name) =>
    set((s) => ({
      driveTracks: s.driveTracks.map((t) => (t.id === id ? { ...t, name } : t)),
    })),

  // ── Cache Status ──────────────────────────────────────
  cachedTrackIds: new Set(),
  setCachedTrackIds: (ids) => set({ cachedTrackIds: ids }),

  markAsCached: (id) =>
    set((s) => {
      const next = new Set(s.cachedTrackIds)
      next.add(id)
      return { cachedTrackIds: next }
    }),

  removeFromCache: (id) =>
    set((s) => {
      const next = new Set(s.cachedTrackIds)
      next.delete(id)
      return { cachedTrackIds: next }
    }),

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

  syncProgress: { total: 0, done: 0, isRunning: false },
  setSyncProgress: (p) =>
    set((s) => ({ syncProgress: { ...s.syncProgress, ...p } })),

  isLoadingTracks: false,
  setIsLoadingTracks: (v) => set({ isLoadingTracks: v }),

  isUploadModalOpen: false,
  setUploadModalOpen: (v) => set({ isUploadModalOpen: v }),

  renamingTrackId: null,
  setRenamingTrackId: (id) => set({ renamingTrackId: id }),
}))
