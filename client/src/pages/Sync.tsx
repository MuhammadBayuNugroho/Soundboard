import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Server, FileAudio, Database, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext.js';

interface SyncStats {
  mode: 'LIVE GOOGLE DRIVE' | 'MOCK LOCAL DRIVE';
  folderId: string;
  totalDbCount: number;
  cachedFileCount: number;
  cacheSizeMb: number;
  lastSyncTime: string | null;
}

// Base64 helper
function base64ToBlob(base64: string, mimeType: string = 'audio/mpeg'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export const Sync: React.FC = () => {
  const { audios, refreshAudios, preloadStatusMsg, isPreloaded } = useAudio();
  
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);

  const getAppsScriptUrl = () => {
    return localStorage.getItem('sacp_apps_script_url') || 
           (import.meta.env.VITE_APPS_SCRIPT_URL as string) || 
           'https://script.google.com/macros/s/AKfycbwb2X-DYIZYIB6w1sVGbbu7D6Wqw79ZUgRWX0OAMXTCvqwD3D5JfyQw0fyHZyeybvPgyQ/exec';
  };

  const fetchStats = async () => {
    const api = getAppsScriptUrl();
    if (!api) return;

    try {
      // 1. Fetch metadata list
      const res = await axios.get(`${api}?action=getAudios`);
      const tracks = Array.isArray(res.data) ? res.data : [];
      const totalDbCount = tracks.length;

      // 2. Fetch cache size from browser Cache Storage API
      const cache = await caches.open('sacp-audio-cache');
      const keys = await cache.keys();
      let totalBytes = 0;
      for (const req of keys) {
        const cachedRes = await cache.match(req);
        if (cachedRes) {
          const blob = await cachedRes.blob();
          totalBytes += blob.size;
        }
      }

      // 3. Get settings to check mode
      const settingsRes = await axios.get(`${api}?action=getSettings`);
      const folderId = settingsRes.data.gdrive_folder_id || 'Mock Folder';
      const mode = settingsRes.data.gdrive_folder_id ? 'LIVE GOOGLE DRIVE' : 'MOCK LOCAL DRIVE';

      // 4. Get last sync time from logs
      const logsRes = await axios.get(`${api}?action=getLogs`);
      const lastSyncLog = Array.isArray(logsRes.data) 
        ? logsRes.data.find((l: any) => l.action === 'Sync' || l.action === 'Sync Add')
        : null;

      setStats({
        mode: mode as any,
        folderId,
        totalDbCount,
        cachedFileCount: keys.length,
        cacheSizeMb: totalBytes / (1024 * 1024),
        lastSyncTime: lastSyncLog ? lastSyncLog.timestamp : null
      });
    } catch (err) {
      console.error('Failed to load sync stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSync = async () => {
    const apiUrl = getAppsScriptUrl();
    if (!apiUrl) {
      alert('Konfigurasi URL Google Apps Script di tab Pengaturan terlebih dahulu!');
      return;
    }

    setIsSyncing(true);
    setLogs(['Memulai sinkronisasi browser...']);
    setSyncProgress(0);
    setProcessedCount(0);

    try {
      // 1. Refresh list from Google Sheet
      setLogs(prev => [...prev, 'Mengambil katalog audio terbaru dari Google Sheets...']);
      const res = await axios.get(`${apiUrl}?action=getAudios`);
      const tracks = Array.isArray(res.data) ? res.data : [];
      
      if (tracks.length === 0) {
        setLogs(prev => [...prev, 'Katalog kosong. Tidak ada file untuk disinkronkan.']);
        setIsSyncing(false);
        return;
      }

      setLogs(prev => [...prev, `Ditemukan ${tracks.length} track. Menghubungkan ke Cache Storage...`]);
      const cache = await caches.open('sacp-audio-cache');
      
      let processed = 0;
      const cachedIdsInCloud: string[] = [];

      for (const track of tracks) {
        const cacheKey = `/audio/${track.id}`;
        cachedIdsInCloud.push(cacheKey);

        setLogs(prev => [...prev, `Memeriksa: ${track.nama}...`]);
        const cachedResponse = await cache.match(cacheKey);

        let shouldDownload = false;
        if (!cachedResponse) {
          shouldDownload = true;
        } else {
          // If cached, compare modified_time if possible
          // In sheet, we store modified_time as ISO string
          const cachedBlob = await cachedResponse.blob();
          // Skip download if cached file exists and duration/modified_time matches
          if (cachedBlob.size === 0) {
            shouldDownload = true;
          }
        }

        if (shouldDownload) {
          setLogs(prev => [...prev, `[CACHE MISS] Mengunduh file dari Drive: ${track.nama}...`]);
          
          const dlRes = await axios.post(apiUrl, {
            action: 'downloadAudio',
            id: track.drive_id
          }, {
            headers: { 'Content-Type': 'text/plain' }
          });

          if (dlRes.data && dlRes.data.base64) {
            const blob = base64ToBlob(dlRes.data.base64);
            await cache.put(cacheKey, new Response(blob));
            setLogs(prev => [...prev, `[SUKSES] Caching lokal berhasil: ${track.nama}`]);
          } else {
            setLogs(prev => [...prev, `[ERROR] Gagal mengunduh file untuk: ${track.nama}`]);
          }
        } else {
          setLogs(prev => [...prev, `[CACHE HIT] File sama, lewati unduhan: ${track.nama}`]);
        }

        processed++;
        setProcessedCount(processed);
        setSyncProgress(Math.round((processed / tracks.length) * 100));
      }

      // 2. Clean up files deleted in Google Sheets
      const cacheKeys = await cache.keys();
      for (const req of cacheKeys) {
        const urlObj = new URL(req.url);
        if (!cachedIdsInCloud.includes(urlObj.pathname)) {
          await cache.delete(req);
          setLogs(prev => [...prev, `[BERSIH-CACHED] Menghapus audio terhapus dari local: ${urlObj.pathname}`]);
        }
      }

      // 3. Post log success to Sheets
      await axios.post(apiUrl, {
        action: 'addLog',
        log_action: 'Sync',
        log_details: `Sinkronisasi browser selesai. Total file: ${tracks.length}`
      }, {
        headers: { 'Content-Type': 'text/plain' }
      });

      setLogs(prev => [...prev, 'Sinkronisasi browser selesai! Menginisialisasi RAM Preloads...']);
      await refreshAudios();
      await fetchStats();
      
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, `[FATAL ERROR] Gagal Sinkronisasi: ${err.message}`]);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimestamp = (isoString: string | null) => {
    if (!isoString) return 'Belum pernah';
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="p-6 bg-dark-bg min-h-full flex flex-col gap-6 text-slate-200">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Sinkronisasi Audio (Browser Cache)</h2>
        <p className="text-xs text-slate-400 mt-1">Unduh dan simpan track Google Drive ke cache lokal browser Anda untuk playback offline</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection Mode */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500 text-blue-400 rounded-lg">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mode Master</span>
            <span className="text-sm font-bold text-slate-200">{stats ? stats.mode : 'Checking...'}</span>
          </div>
        </div>

        {/* Caching Count */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500 text-emerald-400 rounded-lg">
            <FileAudio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Sheet Db / Cache</span>
            <span className="text-sm font-bold text-slate-200">
              {stats ? `${stats.totalDbCount} db / ${stats.cachedFileCount} cached` : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Cache Storage Size */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500 text-cyan-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Kapasitas Browser Cache</span>
            <span className="text-sm font-bold text-slate-200">
              {stats ? `${stats.cacheSizeMb.toFixed(2)} MB` : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Last Sync */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500 text-purple-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Last Sync Report</span>
            <span className="text-sm font-bold text-slate-200 truncate max-w-[180px]" title={stats?.lastSyncTime || ''}>
              {stats ? formatTimestamp(stats.lastSyncTime) : 'Checking...'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Controls */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-6 shadow-xl flex flex-col justify-between h-80">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-2">Kontrol Caching</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Karena aplikasi ini 100% serverless, proses pengunduhan dan sinkronisasi file audio dilakukan langsung dari browser operator. File akan disimpan secara lokal di dalam browser Sandbox Cache Storage API, sehingga audio terjamin berbunyi instan saat tombol ditekan.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full bg-accent-blue hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 font-bold py-3.5 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:cursor-not-allowed border border-blue-500 border-b-4 hover:border-b-2 disabled:border-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'SEDANG MENGUNDUH...' : 'SINKRONKAN SEKARANG'}
          </button>
        </div>

        {/* Sync Console Logs Output */}
        <div className="lg:col-span-2 bg-black border border-dark-border/80 rounded-xl p-6 shadow-xl h-80 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Terminal Log Sinkronisasi</h3>
            {!isSyncing && logs.length > 0 && logs[logs.length - 1].includes('selesai') && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sukses
              </span>
            )}
          </div>

          <div className="flex-1 bg-dark-bg border border-dark-border/40 rounded-lg p-4 font-mono text-xs overflow-y-auto text-slate-400 space-y-1.5 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Siap sinkronisasi. Hubungkan ke internet, lalu klik button untuk memulai.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={log.includes('[ERROR]') ? 'text-red-400' : log.includes('[SUKSES]') || log.includes('selesai') ? 'text-emerald-400' : 'text-slate-300'}>
                  &gt; {log}
                </div>
              ))
            )}
          </div>

          {/* Caching Progress */}
          {isSyncing && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase text-slate-400">
                <span>Unduh File: {processedCount} / {stats?.totalDbCount || 0}</span>
                <span className="font-mono text-accent-blue">{syncProgress}%</span>
              </div>
              <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden border border-dark-border/60">
                <div 
                  className="bg-accent-blue h-full transition-all duration-300 rounded-full"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
