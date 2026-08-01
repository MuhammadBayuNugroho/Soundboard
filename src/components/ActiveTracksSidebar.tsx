import React from 'react'
import { Sliders, X, Volume1, Wind } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface ActiveTracksSidebarProps {
  onStopSingle: (id: string) => void
  onFadeSingle: (id: string, duration: number) => void
}

export const ActiveTracksSidebar: React.FC<ActiveTracksSidebarProps> = ({
  onStopSingle,
  onFadeSingle
}) => {
  const { activeTracks, setTrackVolume } = useAppStore()

  const tracksArray = Array.from(activeTracks.values())

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-200">
          <Sliders className="h-4.5 w-4.5 text-emerald-400" />
          Suara Aktif Diputar
        </h3>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
          {activeTracks.size} Aktif
        </span>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {tracksArray.length === 0 ? (
          <div className="py-8 text-center text-xs italic text-slate-500">
            Tidak ada suara yang sedang diputar. Klik salah satu tombol musik.
          </div>
        ) : (
          tracksArray.map((track) => (
            <div
              key={track.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"
            >
              {/* Header: Track Name & Stop Action */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="font-bold text-slate-200 truncate">{track.name}</span>
                </div>
                <button
                  onClick={() => onStopSingle(track.id)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
                  title="Hentikan"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Slider Volume & Fade Out */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex flex-1 items-center gap-1.5 rounded bg-slate-900 px-2 py-1">
                  <Volume1 className="h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={track.volume}
                    onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-500"
                  />
                </div>

                <button
                  onClick={() => onFadeSingle(track.id, 2)}
                  className="flex items-center gap-1 rounded bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 border border-amber-500/20 text-[10px] font-bold text-amber-400 transition-colors"
                >
                  <Wind className="h-3 w-3" />
                  Fade (2s)
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
