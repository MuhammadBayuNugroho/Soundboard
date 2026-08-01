import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Howl, Howler } from 'howler';
import axios from 'axios';
import { useMqtt } from './MqttContext.js';

export interface AudioTrack {
  id: string;
  drive_id: string | null;
  nama: string;
  kategori: 'Opening' | 'Mars' | 'Sholawat' | 'Efek' | 'Closing' | 'Instrument';
  volume: number;
  fade: number; // 0 or 1
  favorite: number; // 0 or 1
  shortcut: string | null;
  checksum: string | null;
  modified_time: string | null;
  duration: number;
}

interface PlaybackStatus {
  playing: boolean;
  progress: number; // 0 to 100
  currentTime: number;
  duration: number;
}

interface AudioContextProps {
  audios: AudioTrack[];
  playbackState: Record<string, PlaybackStatus>;
  masterVolume: number;
  isMuted: boolean;
  activeMainTrackId: string | null;
  playAudio: (id: string) => void;
  pauseAudio: (id: string) => void;
  stopAudio: (id: string) => void;
  stopAll: () => void;
  setTrackVolume: (id: string, vol: number) => void;
  setMasterVolume: (vol: number) => void;
  toggleMute: () => void;
  refreshAudios: () => Promise<void>;
  isPreloaded: boolean;
  preloadProgress: number; // 0 to 100
  preloadStatusMsg: string;
}

const AudioContext = createContext<AudioContextProps | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

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

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    role, connected, publishCommand, publishStatus, 
    registerCommandListener, registerStatusListener 
  } = useMqtt();

  const [audios, setAudios] = useState<AudioTrack[]>([]);
  const [playbackState, setPlaybackState] = useState<Record<string, PlaybackStatus>>({});
  const [masterVolume, setMasterVolumeState] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeMainTrackId, setActiveMainTrackId] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadStatusMsg, setPreloadStatusMsg] = useState('Standby');

  const howlsRef = useRef<Record<string, Howl>>({});
  const objectUrlsRef = useRef<Record<string, string>>({});
  const fadeOutTimeoutRef = useRef<Record<string, any>>({});
  const progressIntervalRef = useRef<any>(null);

  const getAppsScriptUrl = () => {
    return localStorage.getItem('sacp_apps_script_url') || 
           (import.meta.env.VITE_APPS_SCRIPT_URL as string) || 
           'https://script.google.com/macros/s/AKfycbwb2X-DYIZYIB6w1sVGbbu7D6Wqw79ZUgRWX0OAMXTCvqwD3D5JfyQw0fyHZyeybvPgyQ/exec';
  };

  const refreshAudios = async () => {
    const apiParam = getAppsScriptUrl();
    if (!apiParam) {
      console.warn('Apps Script URL belum dikonfigurasi di Settings.');
      return;
    }

    try {
      const res = await axios.get(`${apiParam}?action=getAudios`);
      // Apps Script might return data directly or wrapped
      const tracks: AudioTrack[] = Array.isArray(res.data) ? res.data : [];
      setAudios(tracks);
      
      const initialStates: Record<string, PlaybackStatus> = {};
      tracks.forEach((track) => {
        initialStates[track.id] = {
          playing: false,
          progress: 0,
          currentTime: 0,
          duration: Number(track.duration) || 0
        };
      });
      setPlaybackState(prev => {
        const next = { ...initialStates };
        Object.keys(prev).forEach(id => {
          if (next[id]) next[id] = prev[id];
        });
        return next;
      });
    } catch (err) {
      console.error('Gagal memuat catalog audio:', err);
    }
  };

  useEffect(() => {
    refreshAudios();
  }, []);

  // ==========================================
  // DESKTOP PLAYER: CACHE RETRIEVAL & PRELOAD
  // ==========================================
  const preloadAllCachedAudios = async () => {
    if (role !== 'player' || audios.length === 0) return;
    
    const apiParam = getAppsScriptUrl();
    if (!apiParam) {
      setPreloadStatusMsg('Error: Apps Script URL Kosong');
      return;
    }

    setIsPreloaded(false);
    setPreloadProgress(0);
    setPreloadStatusMsg('Menyiapkan cache audio...');

    // Clean up old Howler instances and URLs
    Object.values(howlsRef.current).forEach(h => h.unload());
    howlsRef.current = {};
    Object.values(objectUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = {};

    const cache = await caches.open('sacp-audio-cache');
    let loadedCount = 0;

    for (let i = 0; i < audios.length; i++) {
      const track = audios[i];
      const cacheKey = `/audio/${track.id}`;
      
      setPreloadProgress(Math.round((i / audios.length) * 100));
      setPreloadStatusMsg(`Memeriksa: ${track.nama}...`);

      let audioBlob: Blob | null = null;
      const cachedResponse = await cache.match(cacheKey);

      if (cachedResponse) {
        audioBlob = await cachedResponse.blob();
        console.log(`Cache HIT for: ${track.nama}`);
      } else {
        // Cache MISS: Fetch file from Drive via Apps Script base64 proxy to bypass CORS
        try {
          setPreloadStatusMsg(`Mengunduh ke browser: ${track.nama}...`);
          const res = await axios.post(apiParam, {
            action: 'downloadAudio',
            id: track.drive_id
          }, {
            headers: { 'Content-Type': 'text/plain' }
          });
          
          if (res.data && res.data.base64) {
            audioBlob = base64ToBlob(res.data.base64);
            // Save to Cache Storage API
            await cache.put(cacheKey, new Response(audioBlob));
            console.log(`Cached file locally in browser: ${track.nama}`);
          }
        } catch (err) {
          console.error(`Failed to fetch file for: ${track.nama}`, err);
        }
      }

      if (audioBlob) {
        const objectUrl = URL.createObjectURL(audioBlob);
        objectUrlsRef.current[track.id] = objectUrl;

        const howl = new Howl({
          src: [objectUrl],
          format: ['wav', 'mp3', 'ogg', 'm4a'],
          preload: true,
          html5: false, // Forces Web Audio API for latency < 50ms
          volume: Number(track.volume) || 1.0,
          onload: () => {
            loadedCount++;
            const duration = howl.duration();
            
            // If duration in Sheet is 0 or mismatch, update it
            if (Math.abs(Number(track.duration) - duration) > 0.2) {
              axios.post(apiParam, {
                action: 'updateDuration',
                id: track.id,
                duration
              }).catch(() => {});
            }

            setPlaybackState(prev => ({
              ...prev,
              [track.id]: { ...prev[track.id], duration }
            }));

            if (loadedCount === audios.length) {
              setIsPreloaded(true);
              setPreloadProgress(100);
              setPreloadStatusMsg('Semua Audio Preloaded di RAM');
            }
          },
          onloaderror: (_id, err) => {
            console.error(`Preload error for ${track.nama}:`, err);
            loadedCount++;
            if (loadedCount === audios.length) {
              setIsPreloaded(true);
              setPreloadProgress(100);
              setPreloadStatusMsg('Preload Selesai (Beberapa Error)');
            }
          },
          onplay: () => {
            setPlaybackState(prev => ({
              ...prev,
              [track.id]: { ...prev[track.id], playing: true }
            }));
          },
          onpause: () => {
            setPlaybackState(prev => ({
              ...prev,
              [track.id]: { ...prev[track.id], playing: false }
            }));
          },
          onstop: () => {
            setPlaybackState(prev => ({
              ...prev,
              [track.id]: { ...prev[track.id], playing: false, progress: 0, currentTime: 0 }
            }));
          },
          onend: () => {
            setPlaybackState(prev => ({
              ...prev,
              [track.id]: { ...prev[track.id], playing: false, progress: 100, currentTime: track.duration }
            }));
            if (track.kategori !== 'Efek') {
              setActiveMainTrackId(curr => curr === track.id ? null : curr);
            }
          }
        });

        howlsRef.current[track.id] = howl;
      }
    }
  };

  useEffect(() => {
    if (role === 'player' && audios.length > 0) {
      preloadAllCachedAudios();
    }
  }, [role, audios.length]);

  // Player progress reporter loop
  useEffect(() => {
    if (role !== 'player') return;

    progressIntervalRef.current = setInterval(() => {
      let stateChanged = false;
      const updates: Record<string, Partial<PlaybackStatus>> = {};

      Object.entries(howlsRef.current).forEach(([id, howl]) => {
        if (howl.playing()) {
          const seek = howl.seek() as number;
          const dur = howl.duration();
          const progress = dur > 0 ? (seek / dur) * 100 : 0;
          
          updates[id] = {
            playing: true,
            currentTime: seek,
            progress
          };
          stateChanged = true;
        }
      });

      if (stateChanged) {
        setPlaybackState(prev => {
          const next = { ...prev };
          Object.entries(updates).forEach(([id, upd]) => {
            next[id] = { ...next[id], ...upd };
          });
          publishStatus(next);
          return next;
        });
      }
    }, 250);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [role, connected]);

  // Realtime Command Listeners
  useEffect(() => {
    if (role === 'player') {
      const removeListener = registerCommandListener((action, data) => {
        if (action === 'play') localPlay(data.id);
        else if (action === 'pause') localPause(data.id);
        else if (action === 'stop') localStop(data.id);
        else if (action === 'stopAll') localStopAll();
        else if (action === 'setVolume') localSetVolume(data.id, data.volume);
        else if (action === 'masterVolume') localSetMasterVolume(data.volume);
        else if (action === 'mute') localMute(data.mute);
      });
      return removeListener;
    } else {
      // Remote control: sync visual state from status publishes
      const removeListener = registerStatusListener((playerState) => {
        setPlaybackState(playerState);
        
        let activeId: string | null = null;
        Object.entries(playerState).forEach(([id, status]) => {
          const track = audios.find(t => t.id === id);
          const currentStatus = status as PlaybackStatus;
          if (track && track.kategori !== 'Efek' && currentStatus.playing) {
            activeId = id;
          }
        });
        setActiveMainTrackId(activeId);
      });
      return removeListener;
    }
  }, [role, connected, audios]);

  // ==========================================
  // PLAYBACK ACTION IMPLEMENTATIONS
  // ==========================================

  const localPlay = (id: string) => {
    const track = audios.find(t => t.id === id);
    const howl = howlsRef.current[id];
    if (!track || !howl) return;

    if (track.kategori === 'Efek') {
      howl.play();
    } else {
      const prevId = activeMainTrackId;
      if (prevId === id) {
        if (!howl.playing()) {
          howl.volume(0);
          howl.play();
          howl.fade(0, Number(track.volume) || 1.0, 1000);
        }
        return;
      }

      if (prevId) {
        const prevHowl = howlsRef.current[prevId];
        if (prevHowl && prevHowl.playing()) {
          prevHowl.fade(prevHowl.volume(), 0, 3000);
          
          if (fadeOutTimeoutRef.current[prevId]) clearTimeout(fadeOutTimeoutRef.current[prevId]);
          
          fadeOutTimeoutRef.current[prevId] = setTimeout(() => {
            prevHowl.stop();
            howl.volume(0);
            howl.play();
            howl.fade(0, Number(track.volume) || 1.0, 1000);
            setActiveMainTrackId(id);
          }, 3000);
          return;
        }
      }

      howl.volume(0);
      howl.play();
      howl.fade(0, Number(track.volume) || 1.0, 1000);
      setActiveMainTrackId(id);
    }
  };

  const localPause = (id: string) => {
    const howl = howlsRef.current[id];
    if (howl) howl.pause();
  };

  const localStop = (id: string) => {
    const howl = howlsRef.current[id];
    if (howl) howl.stop();
    if (id === activeMainTrackId) {
      setActiveMainTrackId(null);
    }
  };

  const localStopAll = () => {
    Object.values(howlsRef.current).forEach(h => h.stop());
    Object.values(fadeOutTimeoutRef.current).forEach(t => clearTimeout(t));
    fadeOutTimeoutRef.current = {};
    
    setActiveMainTrackId(null);
    setPlaybackState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], playing: false, progress: 0, currentTime: 0 };
      });
      return next;
    });
  };

  const localSetVolume = (id: string, vol: number) => {
    const howl = howlsRef.current[id];
    if (howl) {
      howl.volume(vol);
      setAudios(prev => prev.map(t => t.id === id ? { ...t, volume: vol } : t));
    }
  };

  const localSetMasterVolume = (vol: number) => {
    Howler.volume(vol);
    setMasterVolumeState(vol);
  };

  const localMute = (mute: boolean) => {
    Howler.mute(mute);
    setIsMuted(mute);
  };

  // ==========================================
  // EXPOSED CONTROLLER FUNCTIONS
  // ==========================================

  const playAudio = (id: string) => {
    if (role === 'player') {
      localPlay(id);
      publishCommand('play', { id });
    } else {
      publishCommand('play', { id });
    }
  };

  const pauseAudio = (id: string) => {
    if (role === 'player') {
      localPause(id);
      publishCommand('pause', { id });
    } else {
      publishCommand('pause', { id });
    }
  };

  const stopAudio = (id: string) => {
    if (role === 'player') {
      localStop(id);
      publishCommand('stop', { id });
    } else {
      publishCommand('stop', { id });
    }
  };

  const stopAll = () => {
    if (role === 'player') {
      localStopAll();
      publishCommand('stopAll');
    } else {
      publishCommand('stopAll');
    }
  };

  const setTrackVolume = (id: string, vol: number) => {
    if (role === 'player') {
      localSetVolume(id, vol);
      publishCommand('setVolume', { id, volume: vol });
    } else {
      publishCommand('setVolume', { id, volume: vol });
    }
  };

  const setMasterVolume = (vol: number) => {
    if (role === 'player') {
      localSetMasterVolume(vol);
      publishCommand('masterVolume', { volume: vol });
    } else {
      publishCommand('masterVolume', { volume: vol });
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    if (role === 'player') {
      localMute(nextMute);
      publishCommand('mute', { mute: nextMute });
    } else {
      publishCommand('mute', { mute: nextMute });
    }
  };

  return (
    <AudioContext.Provider
      value={{
        audios,
        playbackState,
        masterVolume,
        isMuted,
        activeMainTrackId,
        playAudio,
        pauseAudio,
        stopAudio,
        stopAll,
        setTrackVolume,
        setMasterVolume,
        toggleMute,
        refreshAudios,
        isPreloaded,
        preloadProgress,
        preloadStatusMsg
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
