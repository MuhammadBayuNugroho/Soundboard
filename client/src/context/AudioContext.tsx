import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Howl, Howler } from 'howler';
import axios from 'axios';
import { useSocket } from './SocketContext.js';

export interface AudioTrack {
  id: string;
  drive_id: string | null;
  nama: string;
  kategori: 'Opening' | 'Mars' | 'Sholawat' | 'Efek' | 'Closing' | 'Instrument';
  local_path: string;
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
}

const AudioContext = createContext<AudioContextProps | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, role } = useSocket();
  const [audios, setAudios] = useState<AudioTrack[]>([]);
  const [playbackState, setPlaybackState] = useState<Record<string, PlaybackStatus>>({});
  const [masterVolume, setMasterVolumeState] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeMainTrackId, setActiveMainTrackId] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);

  // Keep references to Howl instances (Desktop Player mode only)
  const howlsRef = useRef<Record<string, Howl>>({});
  // Track active fade-out timeout to prevent overlaps
  const fadeOutTimeoutRef = useRef<Record<string, any>>({});
  // Interval for polling active audio play progress
  const progressIntervalRef = useRef<any>(null);

  // Fetch audios list
  const refreshAudios = async () => {
    try {
      const res = await axios.get('/api/audio');
      setAudios(res.data);
      
      // Initialize basic state map
      const initialStates: Record<string, PlaybackStatus> = {};
      res.data.forEach((track: AudioTrack) => {
        initialStates[track.id] = {
          playing: false,
          progress: 0,
          currentTime: 0,
          duration: track.duration || 0
        };
      });
      setPlaybackState(prev => {
        // preserve existing playing states if refreshing
        const updated = { ...initialStates };
        Object.keys(prev).forEach(id => {
          if (updated[id]) updated[id] = prev[id];
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to load audios:', err);
    }
  };

  useEffect(() => {
    refreshAudios();
    
    // Listen for changes from REST uploads / admin deletes
    if (socket) {
      socket.on('audio-changed', refreshAudios);
      return () => {
        socket.off('audio-changed', refreshAudios);
      };
    }
  }, [socket]);

  // ==========================================
  // DESKTOP PLAYER LOGIC: PRELOAD & CONTROLS
  // ==========================================
  useEffect(() => {
    if (role !== 'player' || audios.length === 0) return;

    console.log('Initializing Howler.js Player instances for audios...');
    
    // Clean up existing howls
    Object.values(howlsRef.current).forEach(howl => howl.unload());
    howlsRef.current = {};

    let loadedCount = 0;

    audios.forEach((track) => {
      // Resolve path
      const srcUrl = `/cache/${encodeURIComponent(track.local_path)}`;
      
      const howl = new Howl({
        src: [srcUrl],
        format: [track.local_path.split('.').pop() || 'mp3'],
        preload: true,
        html5: false, // Use Web Audio API for latency < 50ms
        volume: track.volume,
        onload: () => {
          loadedCount++;
          const duration = howl.duration();
          
          // If duration in db is different or 0, update it on the server
          if (Math.abs(track.duration - duration) > 0.1) {
            axios.post(`/api/audio/${track.id}/duration`, { duration }).catch(err => {
              console.error('Failed to save duration for:', track.nama, err);
            });
            // Update local track duration
            setAudios(prev => prev.map(t => t.id === track.id ? { ...t, duration } : t));
          }

          setPlaybackState(prev => ({
            ...prev,
            [track.id]: {
              ...prev[track.id],
              duration
            }
          }));

          if (loadedCount === audios.length) {
            setIsPreloaded(true);
            console.log('All audios preloaded successfully.');
          }
        },
        onloaderror: (_id, err) => {
          console.error(`Failed to preload audio: ${track.nama}`, err);
          loadedCount++;
          if (loadedCount === audios.length) {
            setIsPreloaded(true);
          }
        },
        onplay: () => {
          setPlaybackState(prev => ({
            ...prev,
            [track.id]: {
              ...prev[track.id],
              playing: true
            }
          }));
        },
        onpause: () => {
          setPlaybackState(prev => ({
            ...prev,
            [track.id]: {
              ...prev[track.id],
              playing: false
            }
          }));
        },
        onstop: () => {
          setPlaybackState(prev => ({
            ...prev,
            [track.id]: {
              ...prev[track.id],
              playing: false,
              progress: 0,
              currentTime: 0
            }
          }));
        },
        onend: () => {
          setPlaybackState(prev => ({
            ...prev,
            [track.id]: {
              ...prev[track.id],
              playing: false,
              progress: 100,
              currentTime: track.duration
            }
          }));
          
          // Clear active main track ID if BGM finishes playing
          if (track.kategori !== 'Efek') {
            setActiveMainTrackId(currentId => currentId === track.id ? null : currentId);
          }
        }
      });

      howlsRef.current[track.id] = howl;
    });

    return () => {
      Object.values(howlsRef.current).forEach(howl => howl.unload());
    };
  }, [role, audios.length]);

  // Player progress polling interval
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
          
          // Broadcast playing progress to remote controls
          if (socket) {
            socket.emit('player-state-update', next);
          }
          return next;
        });
      }
    }, 250);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [role, socket]);

  // Listen to remote control commands (Player Role) or status updates (Remote Role)
  useEffect(() => {
    if (!socket) return;

    if (role === 'player') {
      // Listen to commands from mobile remotes
      socket.on('play-audio', (data: { id: string }) => {
        localPlay(data.id);
      });
      socket.on('pause-audio', (data: { id: string }) => {
        localPause(data.id);
      });
      socket.on('stop-audio', (data: { id: string }) => {
        localStop(data.id);
      });
      socket.on('stop-all', () => {
        localStopAll();
      });
      socket.on('set-volume', (data: { id: string; volume: number }) => {
        localSetVolume(data.id, data.volume);
      });
      socket.on('master-volume', (data: { volume: number }) => {
        localSetMasterVolume(data.volume);
      });
      socket.on('mute', (data: { mute: boolean }) => {
        localMute(data.mute);
      });
    } else {
      // Remote control role: sync state directly from player broadcasts
      socket.on('player-state-update', (playerState: Record<string, PlaybackStatus>) => {
        setPlaybackState(playerState);
        
        // Find if there is an active main track
        let activeMainId: string | null = null;
        Object.entries(playerState).forEach(([id, status]) => {
          const track = audios.find(t => t.id === id);
          if (track && track.kategori !== 'Efek' && status.playing) {
            activeMainId = id;
          }
        });
        setActiveMainTrackId(activeMainId);
      });
    }

    return () => {
      socket.off('play-audio');
      socket.off('pause-audio');
      socket.off('stop-audio');
      socket.off('stop-all');
      socket.off('set-volume');
      socket.off('master-volume');
      socket.off('mute');
      socket.off('player-state-update');
    };
  }, [role, socket, audios]);

  // ==========================================
  // PLAYBACK ACTION HANDLERS
  // ==========================================

  const localPlay = (id: string) => {
    const track = audios.find(t => t.id === id);
    const howl = howlsRef.current[id];
    if (!track || !howl) return;

    // Check category: Efek (Sound Effect) vs Main Audio
    if (track.kategori === 'Efek') {
      // Sound effect: can be played concurrently, does not interfere with BGM
      howl.play();
    } else {
      // Main Audio category: Fade transitions required, no overlap
      const previousId = activeMainTrackId;

      if (previousId === id) {
        // If clicked track is already playing, do nothing or replay
        if (!howl.playing()) {
          howl.volume(0);
          howl.play();
          howl.fade(0, track.volume, 1000); // fade in 1s
        }
        return;
      }

      // If another BGM is playing, fade it out first, then start the new one
      if (previousId) {
        const prevHowl = howlsRef.current[previousId];
        const prevTrack = audios.find(t => t.id === previousId);
        
        if (prevHowl && prevHowl.playing()) {
          console.log(`Fading out main track: ${prevTrack?.nama}`);
          prevHowl.fade(prevHowl.volume(), 0, 3000); // fade out 3s
          
          // Clear any pending triggers
          if (fadeOutTimeoutRef.current[previousId]) {
            clearTimeout(fadeOutTimeoutRef.current[previousId]);
          }

          // Delay playing the new track until the previous has fully faded out
          // To ensure zero audio overlap
          fadeOutTimeoutRef.current[previousId] = setTimeout(() => {
            prevHowl.stop();
            console.log(`Starting main track after fade-out: ${track.nama}`);
            howl.volume(0);
            howl.play();
            howl.fade(0, track.volume, 1000); // fade in 1s
            setActiveMainTrackId(id);
          }, 3000);
          
          return;
        }
      }

      // No previous track: play immediately with fade-in
      console.log(`Playing main track: ${track.nama}`);
      howl.volume(0);
      howl.play();
      howl.fade(0, track.volume, 1000); // fade in 1s
      setActiveMainTrackId(id);
    }
  };

  const localPause = (id: string) => {
    const howl = howlsRef.current[id];
    if (howl) {
      howl.pause();
    }
  };

  const localStop = (id: string) => {
    const howl = howlsRef.current[id];
    if (howl) {
      howl.stop();
    }
    // Handle BGM cleanup
    if (id === activeMainTrackId) {
      setActiveMainTrackId(null);
    }
  };

  const localStopAll = () => {
    console.log('STOP ALL triggered locally');
    // Stop all howlers
    Object.values(howlsRef.current).forEach(howl => howl.stop());
    // Clear timeouts
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
      // Update local listing volume value
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
  // EXPOSED CONTROLLER TRIGGERS
  // ==========================================

  const playAudio = (id: string) => {
    if (role === 'player') {
      localPlay(id);
      // Broadcast playing state immediately
      if (socket) socket.emit('trigger-play', { id });
    } else {
      // Remote control emits to server
      if (socket) socket.emit('trigger-play', { id });
    }
  };

  const pauseAudio = (id: string) => {
    if (role === 'player') {
      localPause(id);
      if (socket) socket.emit('trigger-pause', { id });
    } else {
      if (socket) socket.emit('trigger-pause', { id });
    }
  };

  const stopAudio = (id: string) => {
    if (role === 'player') {
      localStop(id);
      if (socket) socket.emit('trigger-stop', { id });
    } else {
      if (socket) socket.emit('trigger-stop', { id });
    }
  };

  const stopAll = () => {
    if (role === 'player') {
      localStopAll();
      if (socket) socket.emit('trigger-stop-all');
    } else {
      if (socket) socket.emit('trigger-stop-all');
    }
  };

  const setTrackVolume = (id: string, vol: number) => {
    if (role === 'player') {
      localSetVolume(id, vol);
      if (socket) socket.emit('trigger-set-volume', { id, volume: vol });
    } else {
      if (socket) socket.emit('trigger-set-volume', { id, volume: vol });
    }
  };

  const setMasterVolume = (vol: number) => {
    if (role === 'player') {
      localSetMasterVolume(vol);
      if (socket) socket.emit('trigger-master-volume', { volume: vol });
    } else {
      if (socket) socket.emit('trigger-master-volume', { volume: vol });
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    if (role === 'player') {
      localMute(nextMute);
      if (socket) socket.emit('trigger-mute', { mute: nextMute });
    } else {
      if (socket) socket.emit('trigger-mute', { mute: nextMute });
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
        isPreloaded
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
