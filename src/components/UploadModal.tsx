import React, { useState } from 'react'
import { X, UploadCloud, FileAudio, Check } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { saveLocalTrack } from '../lib/db'

export const UploadModal: React.FC = () => {
  const { isUploadModalOpen, setUploadModalOpen, addTrack } = useAppStore()
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)

  if (!isUploadModalOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadSuccess(false)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setFileName(file.name)

        const trackId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')

        const newTrack = {
          id: trackId,
          name: nameWithoutExt,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          blob: file, // File adalah turunan dari Blob, bisa langsung disimpan ke IndexedDB
          addedAt: new Date()
        }

        // Simpan ke IndexedDB
        await saveLocalTrack(newTrack)
        // Simpan ke Zustand Store
        addTrack(newTrack)
      }

      setUploadSuccess(true)
      setTimeout(() => {
        setUploadModalOpen(false)
        setFileName('')
        setIsUploading(false)
        setUploadSuccess(false)
      }, 1000)
    } catch (err) {
      console.error('Failed to save file locally:', err)
      alert('Gagal menyimpan file audio ke database lokal HP.')
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => setUploadModalOpen(false)}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
          disabled={isUploading}
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-2 text-base font-bold text-slate-200">Tambah File Musik</h3>
        <p className="mb-6 text-xs text-slate-400">
          File musik akan disimpan langsung di memori lokal HP/Laptop Anda. Aplikasi bekerja 100% offline.
        </p>

        {/* Upload Box / Progress Area */}
        {!isUploading ? (
          <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 hover:bg-slate-900/50 hover:border-indigo-500/50 transition-all duration-150">
            <UploadCloud className="mb-3 h-10 w-10 text-slate-500" />
            <span className="text-xs font-bold text-slate-300">Pilih file audio dari HP / Laptop</span>
            <span className="mt-1 text-[10px] text-slate-500">Mendukung MP3, WAV, OGG, M4A</span>
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
            {uploadSuccess ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-3 animate-bounce">
                <Check className="h-6 w-6" />
              </div>
            ) : (
              <FileAudio className="mb-3 h-10 w-10 text-indigo-400 animate-pulse" />
            )}

            <div className="text-xs font-bold text-slate-300 truncate max-w-xs mb-1">
              {fileName}
            </div>
            <div className="text-[10px] text-slate-500">
              {uploadSuccess ? 'Berhasil disimpan!' : 'Menyimpan file audio...'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
