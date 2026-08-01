import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface DeviceClient {
  socketId: string;
  role: 'player' | 'remote';
  userAgent: string;
  ipAddress: string;
  connectedAt: string;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  progress: number;
  message: string;
  totalFiles: number;
  processedFiles: number;
}

interface SocketContextProps {
  socket: Socket | null;
  role: 'player' | 'remote';
  isMobileDevice: boolean;
  connected: boolean;
  deviceList: DeviceClient[];
  syncStatus: SyncStatus | null;
  setDeviceRole: (role: 'player' | 'remote') => void;
}

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceList, setDeviceList] = useState<DeviceClient[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Auto-detect mobile device
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const [role, setRole] = useState<'player' | 'remote'>(
    isMobileDevice ? 'remote' : 'player'
  );

  useEffect(() => {
    // Connect to server (using relative path which matches proxy in dev and absolute origin in prod)
    const socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to SACP Socket Server');
      socketInstance.emit('register-device', { role });
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('device-list', (devices: DeviceClient[]) => {
      setDeviceList(devices);
    });

    socketInstance.on('sync-progress', (status: SyncStatus) => {
      setSyncStatus(status);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [role]);

  const setDeviceRole = (newRole: 'player' | 'remote') => {
    setRole(newRole);
    if (socket && socket.connected) {
      socket.emit('register-device', { role: newRole });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        role,
        isMobileDevice,
        connected,
        deviceList,
        syncStatus,
        setDeviceRole
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
