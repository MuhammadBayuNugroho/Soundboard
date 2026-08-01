import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Server, FileAudio, Database, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

interface SyncStats {
  mode: 'LIVE GOOGLE DRIVE' | 'MOCK LOCAL DRIVE';
  folderId: string;
  totalDbCount: number;
  cachedFileCount: number;
  cacheSizeMb: number;
  lastSyncTime: string | null;
}

interface SyncProps {
  token: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const Sync: React.FC<SyncProps> = ({ token, showToast }) => {
  const { syncStatus } = useSocket();
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/sync/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load sync stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Monitor realtime socket sync updates
  useEffect(() => {
    if (syncStatus) {
      // Append progress messages to terminal logs
      setLogs(prev => {
        // Only append if different from last message to avoid duplicates
        if (prev[prev.length - 1] === syncStatus.message) return prev;
        return [...prev, syncStatus.message];
      });

      if (syncStatus.status === 'success') {
        showToast('Sinkronisasi selesai!', 'success');
        fetchStats();
        setLoading(false);
      } else if (syncStatus.status === 'error') {
        showToast(syncStatus.message, 'error');
        setLoading(false);
      }
    }
  }, [syncStatus]);

  const handleSync = async () => {
    setLoading(true);
    setLogs([]);
    try {
      await axios.post('/api/sync', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('Sinkronisasi dimulai di latar belakang...', 'success');
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Gagal memulai sinkronisasi.';
      showToast(errMsg, 'error');
      setLoading(false);
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

  const isSyncing = syncStatus?.status === 'syncing' || loading;

  return (
    <div className="p-6 bg-dark-bg min-h-full flex flex-col gap-6 text-slate-200">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Sinkronisasi Audio</h2>
        <p className="text-xs text-slate-400 mt-1">Sinkronkan database lokal dan cache file dengan file master di Google Drive</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Drive Mode Card */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className={`p-3 rounded-lg border ${
            stats?.mode.includes('LIVE') 
              ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
              : 'bg-orange-500/10 border-orange-500 text-orange-400'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mode Storage</span>
            <span className="text-sm font-bold text-slate-200">{stats ? stats.mode : 'Checking...'}</span>
          </div>
        </div>

        {/* File Count Card */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500 text-emerald-400 rounded-lg">
            <FileAudio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">File Terdaftar / Cache</span>
            <span className="text-sm font-bold text-slate-200">
              {stats ? `${stats.totalDbCount} db / ${stats.cachedFileCount} local` : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Cache Size Card */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500 text-cyan-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ukuran Cache Lokal</span>
            <span className="text-sm font-bold text-slate-200">
              {stats ? `${stats.cacheSizeMb.toFixed(2)} MB` : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Last Sync Card */}
        <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-5 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500 text-purple-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Sinkronisasi Terakhir</span>
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
            <h3 className="text-base font-bold text-slate-100 mb-2">Kontrol Sinkronisasi</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Proses sinkronisasi akan membandingkan ID file, checksum MD5, dan waktu modifikasi terakhir file di master storage (Google Drive/Mock folder) dengan database lokal Anda. File yang tidak cocok atau baru akan diunduh secara otomatis.
            </p>
            {stats?.mode.includes('MOCK') && (
              <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 mb-4 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  SACP berjalan di <strong>MOCK MODE</strong>. Tambahkan file audio ke folder <code>server/mock_drive/</code> lalu klik sinkronkan untuk menambahkannya ke board.
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full bg-accent-blue hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 font-bold py-3.5 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:cursor-not-allowed border border-blue-500 border-b-4 hover:border-b-2 disabled:border-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'SINKRONISASI BERJALAN...' : 'MULAI SINKRONISASI'}
          </button>
        </div>

        {/* Sync Realtime Console Output */}
        <div className="lg:col-span-2 bg-black border border-dark-border/80 rounded-xl p-6 shadow-xl h-80 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Output Log Sinkronisasi</h3>
            {syncStatus?.status === 'success' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil
              </span>
            )}
          </div>

          {/* Scrolling Logs Panel */}
          <div className="flex-1 bg-dark-bg border border-dark-border/40 rounded-lg p-4 font-mono text-xs overflow-y-auto text-slate-400 space-y-1.5 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Siap sinkronisasi. Klik button untuk memulai.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={log.includes('Gagal') ? 'text-red-400' : log.includes('berhasil') || log.includes('selesai') ? 'text-emerald-400' : 'text-slate-300'}>
                  &gt; {log}
                </div>
              ))
            )}
          </div>

          {/* Sync Progress Bar */}
          {isSyncing && syncStatus && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase text-slate-400">
                <span>Mengunduh: {syncStatus.processedFiles} / {syncStatus.totalFiles}</span>
                <span className="font-mono text-accent-blue">{syncStatus.progress}%</span>
              </div>
              <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden border border-dark-border/60">
                <div 
                  className="bg-accent-blue h-full transition-all duration-300 rounded-full"
                  style={{ width: `${syncStatus.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
