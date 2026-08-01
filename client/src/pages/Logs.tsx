import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Search, Calendar } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
  details: string | null;
}

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/logs');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
    const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    return { dateStr, timeStr };
  };

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 bg-dark-bg min-h-full flex flex-col gap-6 text-slate-200">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Log Aktivitas</h2>
          <p className="text-xs text-slate-400 mt-1">Daftar rekaman aktivitas operator dan kejadian sistem secara realtime</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="bg-dark-surface border border-dark-border text-slate-400 hover:text-slate-200 hover:border-slate-500 font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          RELOAD
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-surface border border-dark-border/60 rounded-xl p-4 flex gap-4 items-center shadow-lg">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kata kunci log (misalnya: 'Opening', 'login', 'sync')..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm transition-colors"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-dark-surface border border-dark-border/60 rounded-xl overflow-hidden shadow-xl flex-1 max-h-[600px] flex flex-col">
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-dark-bg border-b border-dark-border text-xs font-semibold uppercase tracking-wider text-slate-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-36">Waktu</th>
                <th className="px-6 py-4 w-48">Aktivitas</th>
                <th className="px-6 py-4">Detail Kejadian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-slate-500 italic">
                    {loading ? 'Memuat log...' : 'Tidak ada log aktivitas yang cocok.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const { dateStr, timeStr } = formatTimestamp(log.timestamp);
                  
                  // Color highlights based on action name
                  let badgeColor = 'bg-slate-900 border-slate-700 text-slate-400';
                  if (log.action.includes('Add')) badgeColor = 'bg-blue-950 border-blue-900 text-blue-400';
                  else if (log.action.includes('Delete')) badgeColor = 'bg-red-950 border-red-900 text-red-400';
                  else if (log.action.includes('Sync')) badgeColor = 'bg-purple-950 border-purple-900 text-purple-400';
                  else if (log.action.includes('Login')) badgeColor = 'bg-emerald-950 border-emerald-900 text-emerald-400';

                  return (
                    <tr key={log.id} className="hover:bg-dark-surface/60 transition-colors">
                      <td className="px-6 py-3.5 text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>{dateStr}</span>
                        <span className="text-slate-300 font-bold">{timeStr}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-200">
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
