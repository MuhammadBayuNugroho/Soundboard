import React from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface SyncStatusBarProps {
  onSync: () => Promise<void>
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ onSync }) => {
  const { driveTracks, cachedTrackIds, syncProgress, isLocked } = useAppStore()

  // Hanya tampilkan jika sedang sync ATAU sedang di mode Edit
  if (isLocked && !syncProgress.isRunning) return null

  const total = driveTracks.length
  const cachedCount = cachedTrackIds.size
  const isFullyCached = total > 0 && cachedCount === total

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {syncProgress.isRunning ? (
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
          ) : isFullyCached ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          )}

          <div>
            <div className="text-sm font-semibold text-slate-200">
              {syncProgress.isRunning
                ? `Sinkronisasi audio: ${syncProgress.done} / ${syncProgress.total} selesai`
                : isFullyCached
                ? 'Semua audio siap offline'
                : `${cachedCount} dari ${total} audio siap offline (perlu sinkronisasi)`}
            </div>
            <div className="text-xs text-slate-400">
              {syncProgress.isRunning
                ? 'Sedang mengunduh file audio ke browser smartphone Anda...'
                : 'Munduh semua file baru dari Google Drive sebelum pertunjukan dimulai.'}
            </div>
          </div>
        </div>

        {!syncProgress.isRunning && (
          <button
            onClick={onSync}
            disabled={total === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none px-4 py-2 text-xs font-bold text-white shadow-md transition-all duration-150"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync ke Device
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {syncProgress.isRunning && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{
              width: `${(syncProgress.done / (syncProgress.total || 1)) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  )
}
