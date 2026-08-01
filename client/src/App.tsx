import React, { useState, useEffect } from 'react';
import { 
  Radio, Clock, Library, RefreshCw, 
  Settings as SettingsIcon, ClipboardList, Laptop, Smartphone, 
  Star, CheckCircle, Database, LayoutDashboard
} from 'lucide-react';
import axios from 'axios';

import { MqttProvider, useMqtt } from './context/MqttContext.js';
import { AudioProvider, useAudio } from './context/AudioContext.js';
import { Operator } from './pages/Operator.js';
import { Admin } from './pages/Admin.js';
import { Sync } from './pages/Sync.js';
import { Logs } from './pages/Logs.js';
import { Settings } from './pages/Settings.js';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const AppContent: React.FC = () => {
  const { role, connected, roomId, isMobileDevice } = useMqtt();
  const { audios, activeMainTrackId, playbackState, isPreloaded } = useAudio();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'operator' | 'admin' | 'sync' | 'logs' | 'settings'>('operator');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [time, setTime] = useState(new Date());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cacheInfo, setCacheInfo] = useState({ count: 0, sizeMb: 0 });
  const [namaAcara, setNamaAcara] = useState('STAGE AUDIO CONTROL PANEL');

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Event Name and cache stats on load
  const loadGeneralStats = async () => {
    const api = localStorage.getItem('sacp_apps_script_url');
    if (!api) return;

    try {
      // 1. Fetch settings from Apps Script
      const settingsRes = await axios.get(`${api}?action=getSettings`);
      if (settingsRes.data && settingsRes.data.nama_acara) {
        setNamaAcara(settingsRes.data.nama_acara);
      }

      // 2. Fetch cache size from browser Cache Storage API
      const cache = await caches.open('sacp-audio-cache');
      const keys = await cache.keys();
      let totalBytes = 0;
      for (const req of keys) {
        const res = await cache.match(req);
        if (res) {
          const blob = await res.blob();
          totalBytes += blob.size;
        }
      }
      setCacheInfo({
        count: keys.length,
        sizeMb: totalBytes / (1024 * 1024)
      });
    } catch (_) {}
  };

  useEffect(() => {
    loadGeneralStats();
    const interval = setInterval(loadGeneralStats, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Formatting Realtime clock
  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });


  // Render Page Content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'operator':
        return <Operator showFavoritesOnly={showFavOnly} />;
      case 'admin':
        return <Admin token="" showToast={showToast} />;
      case 'sync':
        return <Sync />;
      case 'logs':
        return <Logs />;
      case 'settings':
        return <Settings token="" showToast={showToast} />;
      default:
        return <Operator showFavoritesOnly={showFavOnly} />;
    }
  };

  // ----------------------------------------------------
  // MOBILE NAVIGATION LAYOUT (independent player UI)
  // ----------------------------------------------------
  if (isMobileDevice || role === 'remote') {
    return (
      <div className="flex flex-col min-h-screen bg-dark-bg text-slate-200">
        {/* Mobile Header */}
        <header className="bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-accent-orange animate-pulse" />
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-slate-100">{namaAcara}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              connected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
              {connected ? 'MQTT ON' : 'MQTT OFF'}
            </span>
          </div>
        </header>

        {/* Mobile Main Area */}
        <main className="flex-1 overflow-y-auto">
          {renderTabContent()}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="bg-dark-surface border-t border-dark-border grid grid-cols-5 py-2 sticky bottom-0 z-30 shadow-2xl">
          <button
            onClick={() => { setActiveTab('operator'); setShowFavOnly(false); }}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors ${
              activeTab === 'operator' && !showFavOnly ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider">Operator</span>
          </button>
          
          <button
            onClick={() => { setActiveTab('operator'); setShowFavOnly(true); }}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors ${
              activeTab === 'operator' && showFavOnly ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider">Favorit</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors ${
              activeTab === 'admin' ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Library className="w-5 h-5" />
            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider">Katalog</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors ${
              activeTab === 'sync' ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider">Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors ${
              activeTab === 'settings' ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider">Setting</span>
          </button>
        </nav>

        {/* Floating Toast Notification */}
        {toast && (
          <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider shadow-2xl flex items-center gap-2 z-50 animate-bounce ${
            toast.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
              : 'bg-red-500/10 border-red-500 text-red-400'
          }`}>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // DESKTOP STUDIO LAYOUT
  // ----------------------------------------------------
  return (
    <div className="flex h-screen bg-dark-bg text-slate-200 overflow-hidden">
      
      {/* Sidebar (Permanent on Desktop) */}
      <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col justify-between shrink-0 z-30">
        
        {/* Upper Sidebar */}
        <div>
          {/* Logo Brand */}
          <div className="p-6 border-b border-dark-border flex items-center gap-3">
            <div className="bg-dark-bg p-2 border border-dark-border rounded-lg text-accent-orange shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-slate-100 leading-none">SACP</h1>
              <span className="text-[10px] text-slate-400 font-bold">Serverless Stage</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab('operator'); setShowFavOnly(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'operator' && !showFavOnly ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              DASHBOARD
            </button>

            <button
              onClick={() => { setActiveTab('operator'); setShowFavOnly(true); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'operator' && showFavOnly ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <Star className="w-4 h-4" />
              FAVORIT
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'admin' ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <Library className="w-4 h-4" />
              KATALOG AUDIO
            </button>

            <button
              onClick={() => setActiveTab('sync')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer relative ${
                activeTab === 'sync' ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              SINKRONISASI
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'logs' ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              LOG AKTIVITAS
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-accent-blue text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-bg'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              PENGATURAN
            </button>
          </nav>
        </div>

        {/* Lower Sidebar Client Info */}
        <div className="p-4 border-t border-dark-border space-y-4">
          <div className="bg-dark-bg border border-dark-border p-3.5 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b border-dark-border pb-1.5 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-accent-blue" />
              MQTT Signaling Room
            </div>
            
            <div className="space-y-1.5 font-mono text-[10px] text-slate-300">
              <div className="flex justify-between">
                <span>Room ID:</span>
                <span className="font-bold text-accent-orange">{roomId}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={connected ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {connected ? "CONNECTED" : "OFFLINE"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Peran:</span>
                <span className="font-bold text-blue-400 uppercase">{role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Column Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header Dashboard */}
        <header className="bg-dark-surface border-b border-dark-border/60 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">
              {namaAcara}
            </h2>
            
            {activeMainTrackId && (
              <span className="flex items-center gap-1.5 text-xs text-accent-green bg-accent-green/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold animate-pulse">
                <CheckCircle className="w-3.5 h-3.5" /> BROADCASTING
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                connected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
                {connected ? 'MQTT ACTIVE' : 'MQTT OFFLINE'}
              </span>
            </div>

            {/* Realtime Hour Clock */}
            <div className="flex items-center gap-2 text-slate-100 font-mono font-bold text-sm bg-dark-bg border border-dark-border px-3 py-1 rounded-lg shadow-inner">
              <Clock className="w-4 h-4 text-accent-blue" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Status Cards Deck */}
        {activeTab === 'operator' && (
          <div className="bg-dark-bg px-6 pt-6 grid grid-cols-5 gap-4 shrink-0">
            {/* Card: Audio Count */}
            <div className="bg-dark-surface border border-dark-border/50 rounded-xl p-4 shadow flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <Library className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Katalog Lagu</span>
                <span className="text-sm font-extrabold text-slate-300">{audios.length} Track</span>
              </div>
            </div>

            {/* Card: Active Playing */}
            <div className="bg-dark-surface border border-dark-border/50 rounded-xl p-4 shadow flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Bermain</span>
                <span className="text-sm font-extrabold text-slate-300">
                  {Object.values(playbackState).filter(s => s.playing).length} Sound
                </span>
              </div>
            </div>

            {/* Card: Browser Cache Stats */}
            <div className="bg-dark-surface border border-dark-border/50 rounded-xl p-4 shadow flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Browser Sandbox Cache</span>
                <span className="text-sm font-extrabold text-slate-300">
                  {cacheInfo.count} files ({cacheInfo.sizeMb.toFixed(1)} MB)
                </span>
              </div>
            </div>

            {/* Card: RAM / Device Preload */}
            <div className="bg-dark-surface border border-dark-border/50 rounded-xl p-4 shadow flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Status Preload RAM</span>
                <span className="text-sm font-extrabold text-slate-300">
                  {isPreloaded ? 'READY (100%)' : 'LOADING...'}
                </span>
              </div>
            </div>

            {/* Card: Connection Room */}
            <div className="bg-dark-surface border border-dark-border/50 rounded-xl p-4 shadow flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">MQTT Room ID</span>
                <span className="text-sm font-extrabold text-slate-300">{roomId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Viewport */}
        <main className="flex-1 overflow-hidden">
          {renderTabContent()}
        </main>

        {/* Floating Toast Notification */}
        {toast && (
          <div className={`fixed bottom-24 right-6 px-4 py-3 rounded-lg border text-sm font-bold uppercase tracking-wider shadow-2xl flex items-center gap-2 z-50 animate-bounce ${
            toast.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
              : 'bg-red-500/10 border-red-500 text-red-400'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <MqttProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </MqttProvider>
  );
}
