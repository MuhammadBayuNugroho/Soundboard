import React from 'react'
import { Music, Plus, Loader2, Disc } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { TrackCard } from './TrackCard'
import { renameLocalTrack, removeLocalTrack } from '../lib/db'

interface TrackGridProps {
  onTogglePlay: (id: string, name: string) => void
}

export const TrackGrid: React.FC<TrackGridProps> = ({ onTogglePlay }) => {
  const {
    tracks,
    activeTracks,
    isLocked,
    isLoadingTracks,
    setUploadModalOpen,
    removeTrack,
    renameTrackState
  } = useAppStore()

  const handleRename = async (trackId: string, newName: string) => {
    try {
      await renameLocalTrack(trackId, newName)
      renameTrackState(trackId, newName)
    } catch (err) {
      console.error('Rename track error:', err)
      alert('Gagal mengubah nama audio.')
    }
  }

  const handleDelete = async (trackId: string) => {
    try {
      await removeLocalTrack(trackId)
      removeTrack(trackId)
    } catch (err) {
      console.error('Delete track error:', err)
      alert('Gagal menghapus file audio.')
    }
  }

  if (isLoadingTracks) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium text-slate-400">Memuat daftar musik...</span>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 py-16 text-center">
        <Disc className="mb-4 h-12 w-12 text-slate-600 animate-pulse" />
        <h3 className="mb-1 text-base font-bold text-slate-300">Belum Ada File Musik</h3>
        <p className="mb-6 max-w-sm text-xs text-slate-500">
          {isLocked
            ? 'Tidak ada file musik yang siap diputar. Buka kunci untuk menambahkan musik.'
            : 'Belum ada lagu drama yang diunggah ke memori HP.'}
        </p>

        {!isLocked && (
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-5 py-3 text-xs font-bold text-white shadow-md transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            Tambah File Suara
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-200">
            Daftar Musik Pertunjukan ({tracks.length})
          </h2>
        </div>

        {!isLocked && (
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-3 py-1.5 text-xs font-bold text-white shadow transition-all duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Musik
          </button>
        )}
      </div>

      {/* Grid */}
      <div
        className={`grid gap-4 ${
          isLocked
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
        }`}
      >
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            isPlaying={activeTracks.has(track.id)}
            isCached={true} // Selalu true karena diupload langsung ke local database
            onTogglePlay={() => onTogglePlay(track.id, track.name)}
            onRename={(newName) => handleRename(track.id, newName)}
            onDelete={() => handleDelete(track.id)}
          />
        ))}
      </div>
    </div>
  )
}
