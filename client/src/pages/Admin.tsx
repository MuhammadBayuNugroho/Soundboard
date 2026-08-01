import React, { useState } from 'react';
import { 
  Plus, Edit, Trash2, Star, ToggleLeft, ToggleRight, X, StarOff
} from 'lucide-react';
import axios from 'axios';
import { useAudio } from '../context/AudioContext.js';
import type { AudioTrack } from '../context/AudioContext.js';

interface AdminProps {
  token: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Convert file to Base64 helper
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Gagal membaca file'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const Admin: React.FC<AdminProps> = ({ showToast }) => {
  const { audios, refreshAudios } = useAudio();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<AudioTrack | null>(null);

  // Form State
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState<AudioTrack['kategori']>('Efek');
  const [volume, setVolume] = useState(1.0);
  const [fade, setFade] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const getAppsScriptUrl = () => {
    return localStorage.getItem('sacp_apps_script_url') || 
           (import.meta.env.VITE_APPS_SCRIPT_URL as string) || 
           'https://script.google.com/macros/s/AKfycbwb2X-DYIZYIB6w1sVGbbu7D6Wqw79ZUgRWX0OAMXTCvqwD3D5JfyQw0fyHZyeybvPgyQ/exec';
  };

  const openAddModal = () => {
    setEditingTrack(null);
    setNama('');
    setKategori('Efek');
    setVolume(1.0);
    setFade(true);
    setFavorite(false);
    setShortcut('');
    setFile(null);
    setModalOpen(true);
  };

  const openEditModal = (track: AudioTrack) => {
    setEditingTrack(track);
    setNama(track.nama);
    setKategori(track.kategori);
    setVolume(track.volume);
    setFade(track.fade === 1);
    setFavorite(track.favorite === 1);
    setShortcut(track.shortcut || '');
    setFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const apiUrl = getAppsScriptUrl();
    if (!apiUrl) {
      showToast('Konfigurasi URL Google Apps Script di tab Pengaturan terlebih dahulu!', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingTrack) {
        // Edit metadata in Google Sheets
        await axios.post(apiUrl, {
          action: 'editAudio',
          id: editingTrack.id,
          nama,
          kategori,
          volume,
          fade: fade ? 1 : 0,
          favorite: favorite ? 1 : 0,
          shortcut: shortcut || null
        }, {
          headers: { 'Content-Type': 'text/plain' }
        });
        
        showToast('Audio berhasil diperbarui!', 'success');
      } else {
        // Add new audio to Drive & Sheet
        if (!file) {
          showToast('Harap pilih file audio!', 'error');
          setLoading(false);
          return;
        }

        showToast('Mengompres dan mengunggah audio. Mohon tunggu...', 'success');
        const fileBase64 = await toBase64(file);

        await axios.post(apiUrl, {
          action: 'addAudio',
          filename: file.name,
          mime_type: file.type,
          file_base64: fileBase64,
          nama,
          kategori,
          volume,
          fade: fade ? 1 : 0,
          favorite: favorite ? 1 : 0,
          shortcut: shortcut || null
        }, {
          headers: { 'Content-Type': 'text/plain' }
        });

        showToast('Audio berhasil diunggah ke Google Drive!', 'success');
      }
      
      await refreshAudios();
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Gagal menyimpan audio ke Google Sheets.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const apiUrl = getAppsScriptUrl();
    if (!apiUrl) {
      showToast('Konfigurasi URL Google Apps Script di tab Pengaturan terlebih dahulu!', 'error');
      return;
    }

    if (!window.confirm('Apakah Anda yakin ingin menghapus audio ini? File pada Google Drive master storage dan database Google Sheets juga akan dihapus.')) {
      return;
    }

    try {
      await axios.post(apiUrl, {
        action: 'deleteAudio',
        id: id
      }, {
        headers: { 'Content-Type': 'text/plain' }
      });

      showToast('Audio berhasil dihapus!', 'success');
      await refreshAudios();
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menghapus audio.', 'error');
    }
  };

  return (
    <div className="p-6 bg-dark-bg min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Katalog Audio (Serverless Sheets)</h2>
          <p className="text-xs text-slate-400 mt-1">Kelola database audio, kategori, volume, dan shortcut di Google Sheet</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-accent-blue hover:bg-blue-700 text-slate-100 font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          TAMBAH AUDIO
        </button>
      </div>

      {/* Audio List Table */}
      <div className="bg-dark-surface border border-dark-border/60 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-dark-bg border-b border-dark-border text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Volume</th>
                <th className="px-6 py-4">Fade</th>
                <th className="px-6 py-4">Shortcut</th>
                <th className="px-6 py-4 text-center">Favorit</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40">
              {audios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Belum ada audio terdaftar di Google Sheet. Silakan tambahkan audio!
                  </td>
                </tr>
              ) : (
                audios.map((track) => (
                  <tr key={track.id} className="hover:bg-dark-surface/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div>
                        {track.nama}
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{track.drive_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-dark-bg border-dark-border">
                        {track.kategori}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{Math.round(track.volume * 100)}%</td>
                    <td className="px-6 py-4">
                      {track.fade === 1 ? (
                        <span className="text-emerald-400 font-semibold text-xs uppercase">Ya</span>
                      ) : (
                        <span className="text-slate-500 text-xs uppercase">Tidak</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {track.shortcut ? (
                        <kbd className="bg-dark-bg border border-dark-border text-xs px-2 py-0.5 rounded font-mono">
                          {track.shortcut.toUpperCase()}
                        </kbd>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {track.favorite === 1 ? (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 mx-auto" />
                      ) : (
                        <Star className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(track)}
                          className="p-1.5 bg-dark-bg border border-dark-border hover:border-slate-500 hover:text-slate-100 rounded text-slate-400 transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(track.id)}
                          className="p-1.5 bg-dark-bg border border-red-950 text-red-500 hover:bg-red-950/20 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-lg bg-dark-surface border border-dark-border rounded-xl shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 border-b border-dark-border/60">
              <h3 className="text-lg font-bold text-slate-100">
                {editingTrack ? 'Edit Pengaturan Audio' : 'Unggah Audio Baru'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* File Upload (New Audio only) */}
              {!editingTrack && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    File Audio (Akan diupload ke Google Drive)
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const fileObj = e.target.files?.[0] || null;
                      setFile(fileObj);
                      if (fileObj && !nama) {
                        setNama(fileObj.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-dark-border file:text-xs file:font-semibold file:bg-dark-bg file:text-slate-300 hover:file:bg-dark-bg/85 cursor-pointer file:cursor-pointer"
                  />
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Masukkan nama tampilan..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm transition-colors"
                  required
                />
              </div>

              {/* Grid: Category & Shortcut */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Kategori
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value as AudioTrack['kategori'])}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-accent-blue text-sm transition-colors cursor-pointer"
                  >
                    <option value="Opening">Opening (BGM)</option>
                    <option value="Mars">Mars (BGM)</option>
                    <option value="Sholawat">Sholawat (BGM)</option>
                    <option value="Efek">Efek (Soundboard)</option>
                    <option value="Closing">Closing (BGM)</option>
                    <option value="Instrument">Instrument (BGM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Shortcut Key
                  </label>
                  <input
                    type="text"
                    maxLength={1}
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="Contoh: '1', 'a'..."
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm text-center font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Volume Default</span>
                  <span className="font-mono text-slate-300">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-accent-blue"
                />
              </div>

              {/* Switches: Fade & Favorite */}
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center text-slate-300 text-sm cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setFade(!fade)}
                    className="mr-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {fade ? (
                      <ToggleRight className="w-9 h-9 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-600" />
                    )}
                  </button>
                  Aktifkan Fade Transition (BGM)
                </label>

                <label className="flex items-center text-slate-300 text-sm cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setFavorite(!favorite)}
                    className="mr-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {favorite ? (
                      <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
                    ) : (
                      <StarOff className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                  Favorit
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-dark-border/40">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-dark-border text-slate-400 hover:text-slate-200 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-accent-blue hover:bg-blue-700 text-slate-100 font-bold px-6 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  )}
                  {editingTrack ? 'SIMPAN PERUBAHAN' : 'UNGGAH AUDIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
