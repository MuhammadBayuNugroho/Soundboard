import React from 'react'
import { Volume2, Octagon, Wind } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface MasterControlsProps {
  onStopAll: () => void
  onFadeAll: (duration: number) => void
}

export const MasterControls: React.FC<MasterControlsProps> = ({ onStopAll, onFadeAll }) => {
  const { masterVolume, setMasterVolume } = useAppStore()

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg md:flex-row md:items-center md:justify-between">
      {/* Master Volume Slider */}
      <div className="flex flex-1 items-center gap-4 rounded-xl bg-slate-950 px-4 py-3 border border-slate-800">
        <Volume2 className="h-5 w-5 text-slate-400" />
        <div className="flex flex-1 flex-col">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>MASTER VOLUME</span>
            <span>{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onFadeAll(3)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-600/10 hover:bg-amber-600/20 active:scale-95 px-4 py-3.5 text-sm font-bold text-amber-400 transition-all duration-150 md:flex-none"
        >
          <Wind className="h-4 w-4" />
          Fade Out (3s)
        </button>

        <button
          onClick={onStopAll}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl border border-red-500 bg-red-600 hover:bg-red-700 active:scale-95 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-red-600/20 transition-all duration-150 md:flex-none"
        >
          <Octagon className="h-4 w-4" />
          STOP ALL (PANIC)
        </button>
      </div>
    </div>
  )
}
