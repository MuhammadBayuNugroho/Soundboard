import React, { useState } from 'react'
import { Play, Square, Trash2, Edit2, CheckCircle2, AlertCircle, Check, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { DriveTrack } from '../types'

interface TrackCardProps {
  track: DriveTrack
  isPlaying: boolean
  isCached: boolean
  onTogglePlay: () => void
  onRename: (newName: string) => Promise<void>
  onDelete: () => Promise<void>
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isPlaying,
  isCached,
  onTogglePlay,
  onRename,
  onDelete
}) => {
  const { isLocked } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(track.name)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSaveRename = async () => {
    if (editName.trim() && editName !== track.name) {
      await onRename(editName.trim())
    }
    setIsEditing(false)
  }

  const handleCancelRename = () => {
    setEditName(track.name)
    setIsEditing(false)
  }

  // ── Mode Pentas (Locked) ──────────────────────────────────
  if (isLocked) {
    return (
      <button
        onClick={onTogglePlay}
        disabled={!isCached}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center transition-all duration-150 active:scale-95 select-none w-full min-h-[140px] ${
          !isCached
            ? 'opacity-40 border-slate-800 bg-slate-900/20 cursor-not-allowed'
            : isPlaying
            ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10 animate-pulse-glow'
            : 'border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-slate-700'
        }`}
      >
        {/* Play/Stop Icon */}
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform ${
            isPlaying
              ? 'bg-emerald-500 text-slate-950 scale-110'
              : 'bg-indigo-600/15 text-indigo-400 group-hover:scale-110'
          }`}
        >
          {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
        </div>

        {/* Track Name */}
        <span className="text-sm font-bold text-slate-200 line-clamp-2 px-2">
          {track.name}
        </span>
      </button>
    )
  }

  // ── Mode Edit (Unlocked) ──────────────────────────────────
  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md transition-colors hover:border-slate-700">
      {/* Top Section: Cache Indicator & Actions */}
      <div className="flex items-start justify-between gap-3">
        {/* Status cache */}
        <div className="flex items-center gap-1.5" title={isCached ? 'Siap offline' : 'Belum di-sync'}>
          {isCached ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {isCached ? 'Cached' : 'Drive Only'}
          </span>
        </div>

        {/* Rename & Delete Actions */}
        {!isEditing && !isDeleting && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Ubah Nama"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsDeleting(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
              title="Hapus Musik"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Middle Section: Name / Editor */}
      <div className="my-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-100 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSaveRename}
              className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelRename}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : isDeleting ? (
          <div className="rounded-lg bg-red-950/20 border border-red-900/30 p-2 text-center">
            <div className="text-xs font-semibold text-red-400 mb-2">Hapus dari Google Drive?</div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onDelete}
                className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-500"
              >
                Ya, Hapus
              </button>
              <button
                onClick={() => setIsDeleting(false)}
                className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-750 hover:text-slate-200"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <h4 className="text-sm font-bold text-slate-200 truncate" title={track.name}>
            {track.name}
          </h4>
        )}
      </div>

      {/* Bottom Section: Test Play/Stop */}
      {!isDeleting && !isEditing && (
        <button
          onClick={onTogglePlay}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all ${
            isPlaying
              ? 'bg-red-650 hover:bg-red-700 text-white animate-pulse'
              : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              Stop Musik
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              Test Putar
            </>
          )}
        </button>
      )}
    </div>
  )
}
