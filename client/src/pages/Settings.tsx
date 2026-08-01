import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Save, Shield, Settings2, Sliders, Volume2, Cloud, HardDrive, RefreshCw } from 'lucide-react';

interface SettingsProps {
  token: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const Settings: React.FC<SettingsProps> = ({ token, showToast }) => {
  const [namaAcara, setNamaAcara] = useState('');
  const [logo, setLogo] = useState('');
  const [volumeDefault, setVolumeDefault] = useState(1.0);
  const [outputAudio, setOutputAudio] = useState('Default Output');
  const [gdriveFolderId, setGdriveFolderId] = useState('');
  const [gdriveCredentials, setGdriveCredentials] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/settings');
        const settings = res.data;
        
        setNamaAcara(settings.nama_acara || '');
        setLogo(settings.logo || '');
        setVolumeDefault(parseFloat(settings.volume_default) || 1.0);
        setOutputAudio(settings.output_audio || 'Default Output');
        setGdriveFolderId(settings.gdrive_folder_id || '');
        setGdriveCredentials(settings.gdrive_credentials || '');
        setAutoSync(settings.auto_sync === '1');
        setDarkMode(settings.dark_mode === '1');
      } catch (err) {
        console.error('Failed to load settings:', err);
        showToast('Gagal memuat pengaturan.', 'error');
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/settings', {
        nama_acara: namaAcara,
        logo: logo,
        volume_default: volumeDefault.toString(),
        output_audio: outputAudio,
        gdrive_folder_id: gdriveFolderId,
        gdrive_credentials: gdriveCredentials,
        auto_sync: autoSync ? '1' : '0',
        dark_mode: darkMode ? '1' : '0'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Pengaturan berhasil disimpan!', 'success');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Gagal menyimpan pengaturan.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-dark-bg min-h-full flex flex-col gap-6 text-slate-200">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Pengaturan Sistem</h2>
        <p className="text-xs text-slate-400 mt-1">Konfigurasi profile acara, default soundboard, dan integrasi Google Drive</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Event Info & Defaults */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Config Card */}
          <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-dark-border/40 pb-3">
              <Settings2 className="w-4 h-4 text-accent-blue" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Profil Acara & Audio</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Nama Acara
                </label>
                <input
                  type="text"
                  value={namaAcara}
                  onChange={(e) => setNamaAcara(e.target.value)}
                  placeholder="Masukkan nama acara..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm transition-colors"
                  required
                />
              </div>

              {/* Logo Url */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Logo Acara (URL atau Nama)
                </label>
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="Nama logo atau URL icon..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Default Volume slider */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span>Volume Default Awal</span>
                  <span className="font-mono text-slate-300">{Math.round(volumeDefault * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={volumeDefault}
                  onChange={(e) => setVolumeDefault(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-accent-blue border border-dark-border mt-3"
                />
              </div>

              {/* Audio output selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Output Audio Device
                </label>
                <select
                  value={outputAudio}
                  onChange={(e) => setOutputAudio(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-accent-blue text-sm transition-colors cursor-pointer"
                >
                  <option value="Default Output">Default System Speaker</option>
                  <option value="HDMI Audio Output">HDMI (Stage Sound Output)</option>
                  <option value="USB Soundcard Output">USB Soundcard External</option>
                  <option value="Virtual Mixer (CABLE Input)">Virtual Audio Cable (VB-Audio)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sync Preferences Card */}
          <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-dark-border/40 pb-3">
              <Sliders className="w-4 h-4 text-accent-green" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Prefensi & Tampilan</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-6 pt-2">
              <label className="flex items-center text-slate-300 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded bg-dark-bg border-dark-border text-accent-blue focus:ring-accent-blue w-4 h-4 mr-2.5"
                />
                Aktifkan Auto Sinkronisasi saat aplikasi dibuka
              </label>

              <label className="flex items-center text-slate-300 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  className="rounded bg-dark-bg border-dark-border text-accent-blue focus:ring-accent-blue w-4 h-4 mr-2.5"
                  disabled // Force dark mode as OBS style requires dark mode dominancy
                />
                Gunakan Dark Mode OBS Studio (Wajib Aktif)
              </label>
            </div>
          </div>
        </div>

        {/* Right Col: Google Drive Credentials */}
        <div className="space-y-6">
          <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl flex flex-col justify-between h-[396px]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-dark-border/40 pb-3">
                <Cloud className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Integrasi Google Drive</h3>
              </div>

              {/* Folder ID */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  value={gdriveFolderId}
                  onChange={(e) => setGdriveFolderId(e.target.value)}
                  placeholder="ID folder Google Drive..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm font-mono transition-colors"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Biarkan kosong untuk menggunakan Mock Mode lokal (folder: <code>server/mock_drive/</code>)
                </span>
              </div>

              {/* Service Account JSON */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Service Account JSON Credentials
                </label>
                <textarea
                  value={gdriveCredentials}
                  onChange={(e) => setGdriveCredentials(e.target.value)}
                  placeholder={
                    gdriveCredentials === 'configured' 
                      ? 'Konfigurasi credentials tersimpan. Tulis baru untuk merubah...' 
                      : 'Isi dengan kode JSON Service Account dari Google Cloud Console...'
                  }
                  rows={4}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-xs font-mono transition-colors resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-blue-700 hover:from-blue-700 hover:to-accent-blue text-slate-100 font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
            >
              <Save className="w-4 h-4" />
              {loading ? 'MENYIMPAN...' : 'SIMPAN SEMUA PENGATURAN'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
