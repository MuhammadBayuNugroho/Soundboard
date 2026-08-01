import { useAppStore } from '../store/useAppStore'
import { listTracks, downloadTrackBlob } from '../lib/driveApi'
import { cacheTrack, getCachedTrackIds, removeCachedTrack } from '../lib/db'

export function useSync() {
  const {
    setDriveTracks,
    setCachedTrackIds,
    markAsCached,
    removeFromCache,
    setSyncProgress,
    setIsLoadingTracks,
    accessToken
  } = useAppStore()

  /**
   * Fetch daftar track dari Google Drive dan bandingkan dengan cache lokal
   */
  const refreshTrackList = async () => {
    if (!accessToken) return
    setIsLoadingTracks(true)
    try {
      // 1. Dapatkan file dari Drive
      const tracks = await listTracks()
      setDriveTracks(tracks)

      // 2. Dapatkan ID yang ada di IndexedDB
      const cachedIds = await getCachedTrackIds()
      setCachedTrackIds(cachedIds)
    } catch (err) {
      console.error('Refresh track list error:', err)
    } finally {
      setIsLoadingTracks(false)
    }
  }

  /**
   * Sinkronisasi file audio:
   * - Download file Drive yang belum ada di local cache
   * - Hapus cache lokal yang file aslinya sudah tidak ada di Drive
   */
  const syncWithDrive = async () => {
    if (!accessToken) return
    const { driveTracks, cachedTrackIds } = useAppStore.getState()

    setSyncProgress({ isRunning: true, total: driveTracks.length, done: 0 })

    try {
      // 1. Download file baru/belum tercache
      let doneCount = 0
      for (const track of driveTracks) {
        if (!cachedTrackIds.has(track.id)) {
          try {
            const blob = await downloadTrackBlob(track.id)
            await cacheTrack({
              id: track.id,
              name: track.name,
              fileName: track.fileName,
              mimeType: track.mimeType,
              size: track.size,
              blob
            })
            markAsCached(track.id)
          } catch (err) {
            console.error(`Gagal sync track ${track.name}:`, err)
          }
        } else {
          // Jika sudah dicache, hitung saja
          doneCount++
          setSyncProgress({ done: doneCount })
        }
      }

      // 2. Bersihkan file lokal yang tidak ada di Drive
      const driveTrackIds = new Set(driveTracks.map(t => t.id))
      for (const cachedId of cachedTrackIds) {
        if (!driveTrackIds.has(cachedId)) {
          await removeCachedTrack(cachedId)
          removeFromCache(cachedId)
        }
      }

      // Final progress update
      setSyncProgress({ done: driveTracks.length })
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setSyncProgress({ isRunning: false })
      // Update data di state setelah sinkronisasi
      await refreshTrackList()
    }
  }

  return { refreshTrackList, syncWithDrive }
}
