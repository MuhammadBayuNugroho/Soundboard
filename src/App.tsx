import React, { useEffect } from 'react'
import { Header } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { MasterControls } from './components/MasterControls'
import { TrackGrid } from './components/TrackGrid'
import { ActiveTracksSidebar } from './components/ActiveTracksSidebar'
import { UploadModal } from './components/UploadModal'
import { useLocalAuth } from './hooks/useLocalAuth'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useAppStore } from './store/useAppStore'

export const App: React.FC = () => {
  const { loginWithPIN, logout, isLoggedIn } = useLocalAuth()
  const { togglePlay, stopTrack, stopAll, fadeOutTrack, fadeOutAll } = useAudioPlayer()
  const { loadTracksFromDB } = useAppStore()

  // 1. Fetch file list dari local IndexedDB saat pertama kali login
  useEffect(() => {
    if (isLoggedIn) {
      loadTracksFromDB()
    }
  }, [isLoggedIn, loadTracksFromDB])

  // 2. Setup Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hiraukan tombol saat mengetik di form rename / input text
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = e.key.toUpperCase()

      // ESC atau SPACE untuk Stop All (Panic)
      if (key === 'ESCAPE' || key === ' ') {
        e.preventDefault()
        stopAll()
        return
      }

      // F untuk Fade Out All (3 detik)
      if (key === 'F') {
        e.preventDefault()
        fadeOutAll(3)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [stopAll, fadeOutAll])

  if (!isLoggedIn) {
    return <LoginScreen onLoginWithPIN={loginWithPIN} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 pb-8 text-slate-100 select-none">
      <Header onLogout={logout} />

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Workspace Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main Controls & Sound Deck (Grid Kiri) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Volume Master, Fade, Stop All */}
            <MasterControls onStopAll={stopAll} onFadeAll={fadeOutAll} />

            {/* Grid Tombol Musik */}
            <TrackGrid onTogglePlay={togglePlay} />
          </div>

          {/* Sidebar Kanan: Suara Aktif Diputar */}
          <div className="space-y-6 lg:col-span-1">
            <ActiveTracksSidebar
              onStopSingle={stopTrack}
              onFadeSingle={fadeOutTrack}
            />

            {/* Keyboard Shortcuts Hint */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
              <h4 className="mb-2 font-bold text-slate-300">Shortcut Keyboard:</h4>
              <div className="grid grid-cols-1 gap-2 font-mono text-[11px]">
                <div className="flex justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                  <span>ESC / SPASI</span>
                  <span className="text-red-400 font-bold">STOP ALL</span>
                </div>
                <div className="flex justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                  <span>F</span>
                  <span className="text-amber-400 font-bold">Fade Out All (3s)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Upload */}
      <UploadModal />
    </div>
  )
}

export default App
