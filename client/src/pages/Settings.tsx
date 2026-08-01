import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings2, Sliders, Cloud, Laptop, Smartphone } from 'lucide-react';
import { useMqtt } from '../context/MqttContext.js';

interface SettingsProps {
  token: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const Settings: React.FC<SettingsProps> = ({ showToast }) => {
  const { role, roomId, setRoomId, setDeviceRole } = useMqtt();
  
  const [namaAcara, setNamaAcara] = useState('STAGE AUDIO CONTROL PANEL');
  const [appsScriptUrl, setAppsScriptUrl] = useState(() => {
    return localStorage.getItem('sacp_apps_script_url') || 
           (import.meta.env.VITE_APPS_SCRIPT_URL as string) || 
           'https://script.google.com/macros/s/AKfycbwb2X-DYIZYIB6w1sVGbbu7D6Wqw79ZUgRWX0OAMXTCvqwD3D5JfyQw0fyHZyeybvPgyQ/exec';
  });
  const [mqttRoomInput, setMqttRoomInput] = useState(roomId);
  const [volumeDefault, setVolumeDefault] = useState(1.0);
  const [outputAudio, setOutputAudio] = useState('Default Output');
  const [gdriveFolderId, setGdriveFolderId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const api = localStorage.getItem('sacp_apps_script_url');
      if (!api) return;

      try {
        const res = await axios.get(`${api}?action=getSettings`);
        const settings = res.data;
        
        if (settings.nama_acara) setNamaAcara(settings.nama_acara);
        if (settings.volume_default) setVolumeDefault(parseFloat(settings.volume_default) || 1.0);
        if (settings.gdrive_folder_id) setGdriveFolderId(settings.gdrive_folder_id);
      } catch (err) {
        console.error('Failed to load settings from Sheets:', err);
      }
    };

    fetchSettings();
  }, [appsScriptUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Save local configurations first
    localStorage.setItem('sacp_apps_script_url', appsScriptUrl.trim());
    setRoomId(mqttRoomInput);
    
    // 2. Try to sync config to Google Sheets database if URL is valid
    if (appsScriptUrl.trim()) {
      try {
        await axios.post(appsScriptUrl.trim(), {
          action: 'saveSettings',
          settings: {
            nama_acara: namaAcara,
            volume_default: volumeDefault.toString(),
            gdrive_folder_id: gdriveFolderId,
            mqtt_room_id: mqttRoomInput.trim().toUpperCase()
          }
        }, {
          headers: { 'Content-Type': 'text/plain' }
        });
        
        // Post log success
        await axios.post(appsScriptUrl.trim(), {
          action: 'addLog',
          log_action: 'Settings Change',
          log_details: 'Mengubah pengaturan sistem'
        }, {
          headers: { 'Content-Type': 'text/plain' }
        });

        showToast('Pengaturan berhasil disimpan ke Google Sheets!', 'success');
      } catch (err: any) {
        console.error(err);
        showToast('Gagal menyimpan ke Google Sheets, tetapi pengaturan lokal berhasil disimpan.', 'error');
      }
    } else {
      showToast('Pengaturan lokal disimpan (URL Google Apps Script kosong).', 'success');
    }
    
    setLoading(false);
  };

  return (
    <div className="p-6 bg-dark-bg min-h-full flex flex-col gap-6 text-slate-200">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Pengaturan Sistem (Serverless)</h2>
        <p className="text-xs text-slate-400 mt-1">Konfigurasi profile acara, API Google Workspace, dan MQTT Room ID untuk remote control</p>
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

              {/* Speaker Select */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Output Audio Device (Browser)
                </label>
                <select
                  value={outputAudio}
                  onChange={(e) => setOutputAudio(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-accent-blue text-sm transition-colors cursor-pointer"
                >
                  <option value="Default Output">Default Browser Speaker</option>
                </select>
              </div>
            </div>

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
          </div>

          {/* Device Role Card */}
          <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-dark-border/40 pb-3">
              <Sliders className="w-4 h-4 text-accent-green" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Peran Perangkat</h3>
            </div>

            <p className="text-xs text-slate-400">
              Pilih peran perangkat ini. Perangkat <strong>Desktop Player</strong> wajib dibuka di PC operator utama yang terhubung ke sound system untuk mengeluarkan suara. Perangkat <strong>Mobile Remote</strong> hanya mengirimkan perintah klik tanpa memutar suara.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setDeviceRole('player')}
                className={`py-4 px-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
                  role === 'player'
                    ? 'bg-accent-blue/10 border-accent-blue text-slate-100'
                    : 'bg-dark-bg border-dark-border text-slate-400 hover:border-slate-600'
                }`}
              >
                <Laptop className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Desktop Player</span>
              </button>

              <button
                type="button"
                onClick={() => setDeviceRole('remote')}
                className={`py-4 px-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
                  role === 'remote'
                    ? 'bg-accent-blue/10 border-accent-blue text-slate-100'
                    : 'bg-dark-bg border-dark-border text-slate-400 hover:border-slate-600'
                }`}
              >
                <Smartphone className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Mobile Remote</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Google Drive & MQTT Connections */}
        <div className="space-y-6">
          <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl flex flex-col justify-between h-[396px]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-dark-border/40 pb-3">
                <Cloud className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Integrasi Serverless</h3>
              </div>

              {/* Apps Script Web App URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="text"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-xs font-mono transition-colors"
                  required
                />
              </div>

              {/* MQTT Room ID */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  MQTT Room ID (Kode Remote Control)
                </label>
                <input
                  type="text"
                  value={mqttRoomInput}
                  onChange={(e) => setMqttRoomInput(e.target.value)}
                  placeholder="SACP-ROOM-CODE"
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm font-mono text-center font-bold tracking-widest transition-colors uppercase"
                  required
                />
              </div>

              {/* Folder ID */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Google Drive Folder ID (Optional)
                </label>
                <input
                  type="text"
                  value={gdriveFolderId}
                  onChange={(e) => setGdriveFolderId(e.target.value)}
                  placeholder="ID Folder Master Storage..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-xs font-mono transition-colors"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Kosongkan untuk auto-create folder <code>SACP_Audio_Master</code> di Google Drive.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-blue to-blue-700 hover:from-blue-700 hover:to-accent-blue text-slate-100 font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
            >
              {loading ? 'MENYIMPAN...' : 'SIMPAN SEMUA PENGATURAN'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
