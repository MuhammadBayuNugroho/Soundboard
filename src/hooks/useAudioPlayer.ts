import { useAppStore } from '../store/useAppStore'
import { db } from '../lib/db'

export function useAudioPlayer() {
  const {
    activeTracks,
    registerTrack,
    unregisterTrack,
    masterVolume,
    stopAllTracks
  } = useAppStore()

  /**
   * Putar / Hentikan track berdasarkan ID
   */
  const togglePlay = async (trackId: string, trackName: string) => {
    // Jika track sedang aktif diputar, stop track tersebut
    if (activeTracks.has(trackId)) {
      stopTrack(trackId)
      return
    }

    try {
      // 1. Ambil data dari IndexedDB
      const record = await db.tracks.get(trackId)
      if (!record) {
        alert('File audio tidak ditemukan di memori lokal.')
        return
      }

      // 2. Buat Object URL dari Blob
      const objectUrl = URL.createObjectURL(record.blob)
      const audio = new Audio(objectUrl)
      
      // 3. Set volume awal berdasarkan master volume
      audio.volume = masterVolume

      // 4. Definisikan fungsi stop
      const stopFn = () => {
        audio.pause()
        audio.currentTime = 0
        unregisterTrack(trackId)
        URL.revokeObjectURL(objectUrl)
      }

      // 5. Hubungkan event handler saat audio selesai
      audio.onended = () => {
        stopFn()
      }

      // 6. Register ke state store
      registerTrack({
        id: trackId,
        name: trackName,
        volume: 1.0, // volume individual track
        audioElement: audio,
        stopFn
      })

      // 7. Mulai putar audio
      await audio.play()
    } catch (err) {
      console.error('Playback error:', err)
      unregisterTrack(trackId)
    }
  }

  /**
   * Hentikan satu track secara langsung
   */
  const stopTrack = (trackId: string) => {
    const track = activeTracks.get(trackId)
    if (track) {
      track.stopFn()
    }
  }

  /**
   * Fade out track secara perlahan (misal 2-3 detik) lalu stop
   */
  const fadeOutTrack = (trackId: string, durationSeconds = 3) => {
    const track = activeTracks.get(trackId)
    if (!track || !track.audioElement) return

    const audio = track.audioElement
    const startVol = audio.volume
    const steps = 30
    const intervalMs = (durationSeconds * 1000) / steps
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps
      const newVol = Math.max(0, startVol * (1 - progress))
      
      audio.volume = newVol

      if (currentStep >= steps) {
        clearInterval(interval)
        stopTrack(trackId)
      }
    }, intervalMs)
  }

  /**
   * Fade out semua track aktif sekaligus
   */
  const fadeOutAll = (durationSeconds = 3) => {
    activeTracks.forEach((_, trackId) => {
      fadeOutTrack(trackId, durationSeconds)
    })
  }

  return {
    togglePlay,
    stopTrack,
    stopAll: stopAllTracks,
    fadeOutTrack,
    fadeOutAll,
    activeTracks
  }
}
