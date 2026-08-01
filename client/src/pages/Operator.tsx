import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Star, Square, Music, 
  Sparkles, Zap, ShieldAlert, Disc, Volume2, VolumeX, AlertTriangle
} from 'lucide-react';
import { useAudio } from '../context/AudioContext.js';
import type { AudioTrack } from '../context/AudioContext.js';
import { useKeyPress } from '../hooks/useKeyPress.js';

// Helper to format time (e.g. 74s -> "01:14")
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === null) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Map Lucide icons based on category
const getCategoryIcon = (category: AudioTrack['kategori']) => {
  switch (category) {
    case 'Opening': return Disc;
    case 'Mars': return Sparkles;
    case 'Sholawat': return Music;
    case 'Efek': return Zap;
    case 'Closing': return ShieldAlert;
    case 'Instrument': return Music;
    default: return Music;
  }
};

// Map color classes based on category
const getCategoryColors = (category: AudioTrack['kategori']) => {
  switch (category) {
    case 'Opening': 
      return {
        border: 'border-category-opening/40',
        activeBorder: 'border-category-opening',
        bg: 'bg-category-opening/10',
        badge: 'bg-category-opening/25 text-blue-400 border-category-opening/30',
        text: 'text-blue-400',
        glow: 'shadow-blue-500/10'
      };
    case 'Mars': 
      return {
        border: 'border-category-mars/40',
        activeBorder: 'border-category-mars',
        bg: 'bg-category-mars/10',
        badge: 'bg-category-mars/25 text-emerald-400 border-category-mars/30',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/10'
      };
    case 'Sholawat': 
      return {
        border: 'border-category-sholawat/40',
        activeBorder: 'border-category-sholawat',
        bg: 'bg-category-sholawat/10',
        badge: 'bg-category-sholawat/25 text-purple-400 border-category-sholawat/30',
        text: 'text-purple-400',
        glow: 'shadow-purple-500/10'
      };
    case 'Efek': 
      return {
        border: 'border-category-efek/40',
        activeBorder: 'border-category-efek',
        bg: 'bg-category-efek/10',
        badge: 'bg-category-efek/25 text-red-400 border-category-efek/30',
        text: 'text-red-400',
        glow: 'shadow-red-500/10'
      };
    case 'Closing': 
      return {
        border: 'border-category-closing/40',
        activeBorder: 'border-category-closing',
        bg: 'bg-category-closing/10',
        badge: 'bg-category-closing/25 text-orange-400 border-category-closing/30',
        text: 'text-orange-400',
        glow: 'shadow-orange-500/10'
      };
    case 'Instrument': 
      return {
        border: 'border-category-instrument/40',
        activeBorder: 'border-category-instrument',
        bg: 'bg-category-instrument/10',
        badge: 'bg-category-instrument/25 text-cyan-400 border-category-instrument/30',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/10'
      };
    default:
      return {
        border: 'border-slate-700',
        activeBorder: 'border-slate-500',
        bg: 'bg-slate-800/50',
        badge: 'bg-slate-800 text-slate-400 border-slate-700',
        text: 'text-slate-400',
        glow: 'shadow-slate-500/10'
      };
  }
};

interface OperatorProps {
  showFavoritesOnly?: boolean;
}

export const Operator: React.FC<OperatorProps> = ({ showFavoritesOnly = false }) => {
  const {
    audios,
    playbackState,
    masterVolume,
    isMuted,
    playAudio,
    stopAudio,
    stopAll,
    setMasterVolume,
    toggleMute
  } = useAudio();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Filter categories
  const categories = ['Semua', 'Opening', 'Mars', 'Sholawat', 'Efek', 'Closing', 'Instrument'];

  // Handle keyboard shortcuts binding dynamically
  audios.forEach((track) => {
    useKeyPress(track.shortcut, () => {
      // Toggle play/stop on shortcut press
      const status = playbackState[track.id];
      if (status && status.playing) {
        stopAudio(track.id);
      } else {
        playAudio(track.id);
      }
    });
  });

  // Bind Spacebar to Stop All (very standard stage panel convention!)
  useKeyPress(' ', () => {
    stopAll();
  });

  // Filtered tracks
  const filteredAudios = audios.filter((track) => {
    const matchesSearch = track.nama.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || track.kategori === selectedCategory;
    const matchesFav = !showFavoritesOnly || track.favorite === 1;
    return matchesSearch && matchesCategory && matchesFav;
  });

  const handleCardClick = (track: AudioTrack) => {
    const state = playbackState[track.id];
    if (state && state.playing) {
      if (track.kategori === 'Efek') {
        // Sound effects overlapping trigger: play again
        playAudio(track.id);
      } else {
        // BGMs fade out / stop on second click
        stopAudio(track.id);
      }
    } else {
      playAudio(track.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg text-slate-200">
      {/* Top Filter & Search Bar */}
      <div className="bg-dark-surface border-b border-dark-border/60 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari audio realtime..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm transition-colors"
          />
        </div>

        {/* Category Selector Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-accent-blue border-blue-500 text-slate-100 shadow-md shadow-blue-500/10'
                    : 'bg-dark-bg border-dark-border text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {filteredAudios.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-slate-500">
            <AlertTriangle className="w-12 h-12 mb-3 text-slate-600" />
            <p className="text-sm">Tidak ada audio ditemukan yang cocok dengan kriteria.</p>
          </div>
        ) : (
          <motion.div 
            layout 
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredAudios.map((track) => {
                const state = playbackState[track.id] || { playing: false, progress: 0, currentTime: 0, duration: track.duration };
                const colors = getCategoryColors(track.kategori);
                const Icon = getCategoryIcon(track.kategori);

                return (
                  <motion.button
                    layout
                    key={track.id}
                    onClick={() => handleCardClick(track)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{ minHeight: '100px' }}
                    className={`relative w-full rounded-xl border p-4 text-left flex flex-col justify-between overflow-hidden shadow-lg transition-all duration-200 group cursor-pointer ${
                      state.playing
                        ? `bg-dark-surface border-accent-green shadow-emerald-500/10 ring-1 ring-emerald-500`
                        : `bg-dark-surface ${colors.border} hover:border-slate-500 hover:bg-dark-surface/90`
                    }`}
                  >
                    {/* Linear Progress Bar Background */}
                    {state.playing && (
                      <div 
                        className="absolute bottom-0 left-0 top-0 bg-emerald-500/5 transition-all duration-300 pointer-events-none"
                        style={{ width: `${state.progress}%` }}
                      />
                    )}

                    {/* Top Content Row */}
                    <div className="flex items-start justify-between w-full z-10">
                      <div className="flex items-center gap-2">
                        {/* Audio Category Icon */}
                        <div className={`p-1.5 rounded-lg bg-dark-bg border border-dark-border text-slate-400 group-hover:text-slate-200`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {/* Category Badge */}
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${colors.badge}`}>
                          {track.kategori}
                        </span>
                      </div>
                      
                      {/* Keyboard Shortcut Key */}
                      {track.shortcut && (
                        <kbd className="bg-dark-bg border border-dark-border text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded">
                          {track.shortcut.toUpperCase()}
                        </kbd>
                      )}
                    </div>

                    {/* Middle Title Row */}
                    <div className="mt-4 mb-2 z-10">
                      <h3 className="font-bold text-slate-200 text-sm group-hover:text-slate-100 line-clamp-2 leading-tight">
                        {track.nama}
                      </h3>
                    </div>

                    {/* Bottom Status Row */}
                    <div className="flex items-center justify-between w-full mt-auto z-10 text-xs text-slate-400">
                      {/* Duration / Progress Timer */}
                      <span className="font-mono text-[11px]">
                        {state.playing 
                          ? `${formatTime(state.currentTime)} / ${formatTime(state.duration || track.duration)}`
                          : formatTime(track.duration || state.duration)
                        }
                      </span>

                      {/* Equalizer Wave / Star Favorite */}
                      <div className="flex items-center gap-2">
                        {state.playing ? (
                          /* Visual Equalizer Bars */
                          <div className="flex items-end gap-0.5 h-6">
                            <span className="w-[3px] bg-accent-green rounded-full animate-eq-1" />
                            <span className="w-[3px] bg-accent-green rounded-full animate-eq-2" />
                            <span className="w-[3px] bg-accent-green rounded-full animate-eq-3" />
                            <span className="w-[3px] bg-accent-green rounded-full animate-eq-4" />
                          </div>
                        ) : track.favorite === 1 ? (
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ) : null}
                      </div>
                    </div>

                    {/* Tactile Inner Border Glow (OBS/Companion Style) */}
                    <div className={`absolute inset-x-0 bottom-0 h-[2px] transition-colors duration-200 ${
                      state.playing ? 'bg-accent-green' : 'bg-transparent'
                    }`} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Master Control Dock (Sticky Bottom Panel) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-dark-surface border-t border-dark-border px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-20 shadow-2xl">
        {/* Active Audio State Summary */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-dark-bg p-2.5 border border-dark-border rounded-lg text-slate-400 flex items-center justify-center">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Mode Operator
            </div>
            <div className="text-sm font-bold text-slate-200">
              {audios.some(t => playbackState[t.id]?.playing) 
                ? 'AUDIO SEDANG BERMAIN' 
                : 'STANDBY / SIAP'
              }
            </div>
          </div>
        </div>

        {/* Master Controls Volume & Mute */}
        <div className="flex items-center gap-4 w-full md:w-80 justify-center">
          <button 
            onClick={toggleMute}
            className={`p-2 border rounded-lg cursor-pointer transition-colors ${
              isMuted 
                ? 'bg-red-500/25 border-red-500 text-red-400 hover:bg-red-500/35' 
                : 'bg-dark-bg border-dark-border text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Vol</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-accent-blue border border-dark-border"
            />
            <span className="text-xs font-mono w-8 text-right text-slate-400">
              {Math.round((isMuted ? 0 : masterVolume) * 100)}%
            </span>
          </div>
        </div>

        {/* Emergency Stop Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={stopAll}
            className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 active:bg-red-800 text-slate-100 font-extrabold px-8 py-3 rounded-lg shadow-lg hover:shadow-red-900/40 text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500 border-b-4 hover:border-b-2 active:border-b-0 h-12"
          >
            <Square className="w-4 h-4 fill-slate-100" />
            STOP ALL (SPACE)
          </button>
        </div>
      </div>
    </div>
  );
};
