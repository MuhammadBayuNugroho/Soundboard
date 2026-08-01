import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import mqtt from 'mqtt';

interface MqttContextProps {
  connected: boolean;
  role: 'player' | 'remote';
  isMobileDevice: boolean;
  roomId: string;
  setRoomId: (id: string) => void;
  setDeviceRole: (role: 'player' | 'remote') => void;
  publishCommand: (action: string, data?: any) => void;
  publishStatus: (status: any) => void;
  registerCommandListener: (callback: (action: string, data: any) => void) => () => void;
  registerStatusListener: (callback: (status: any) => void) => () => void;
}

const MqttContext = createContext<MqttContextProps | undefined>(undefined);

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within a MqttProvider');
  }
  return context;
};

const PUBLIC_BROKER_URL = 'wss://broker.hivemq.com:8000/mqtt'; // Free public broker

export const MqttProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomIdState] = useState<string>(() => {
    return localStorage.getItem('sacp_mqtt_room') || 'SACP-TRIAL-ROOM';
  });

  // Auto-detect mobile device
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const [role, setRole] = useState<'player' | 'remote'>('player');

  const clientRef = useRef<any>(null);
  const commandListenersRef = useRef<((action: string, data: any) => void)[]>([]);
  const statusListenersRef = useRef<((status: any) => void)[]>([]);

  useEffect(() => {
    console.log(`Connecting to MQTT broker: ${PUBLIC_BROKER_URL}`);
    const client = mqtt.connect(PUBLIC_BROKER_URL, {
      clientId: `sacp_${role}_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      keepalive: 60
    });

    clientRef.current = client;

    client.on('connect', () => {
      setConnected(true);
      console.log(`Connected to MQTT broker! Room: ${roomId}, Role: ${role}`);
      
      // Subscribe based on role
      const cmdTopic = `sacp/${roomId}/command`;
      const statusTopic = `sacp/${roomId}/status`;

      if (role === 'player') {
        // Player listens for commands from Remotes
        client.subscribe(cmdTopic, (err) => {
          if (!err) console.log(`Subscribed to commands: ${cmdTopic}`);
        });
      } else {
        // Remote listens for playback status updates from Player
        client.subscribe(statusTopic, (err) => {
          if (!err) console.log(`Subscribed to status reports: ${statusTopic}`);
        });
      }
    });

    client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const cmdTopic = `sacp/${roomId}/command`;
        const statusTopic = `sacp/${roomId}/status`;

        if (topic === cmdTopic && role === 'player') {
          // Command received: notify listeners
          commandListenersRef.current.forEach(cb => cb(payload.action, payload.data));
        } else if (topic === statusTopic && role === 'remote') {
          // Status update received: notify listeners
          statusListenersRef.current.forEach(cb => cb(payload));
        }
      } catch (err) {
        console.error('Failed to parse MQTT message:', err);
      }
    });

    client.on('close', () => {
      setConnected(false);
    });

    client.on('error', (err) => {
      console.error('MQTT error:', err);
    });

    return () => {
      client.end();
    };
  }, [roomId, role]);

  const setRoomId = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    setRoomIdState(cleanId);
    localStorage.setItem('sacp_mqtt_room', cleanId);
  };

  const setDeviceRole = (newRole: 'player' | 'remote') => {
    setRole(newRole);
  };

  const publishCommand = (action: string, data?: any) => {
    if (clientRef.current && connected) {
      const topic = `sacp/${roomId}/command`;
      clientRef.current.publish(topic, JSON.stringify({ action, data }), { qos: 0 });
    }
  };

  const publishStatus = (status: any) => {
    if (clientRef.current && connected && role === 'player') {
      const topic = `sacp/${roomId}/status`;
      clientRef.current.publish(topic, JSON.stringify(status), { qos: 0 });
    }
  };

  const registerCommandListener = (callback: (action: string, data: any) => void) => {
    commandListenersRef.current.push(callback);
    return () => {
      commandListenersRef.current = commandListenersRef.current.filter(cb => cb !== callback);
    };
  };

  const registerStatusListener = (callback: (status: any) => void) => {
    statusListenersRef.current.push(callback);
    return () => {
      statusListenersRef.current = statusListenersRef.current.filter(cb => cb !== callback);
    };
  };

  return (
    <MqttContext.Provider
      value={{
        connected,
        role,
        isMobileDevice,
        roomId,
        setRoomId,
        setDeviceRole,
        publishCommand,
        publishStatus,
        registerCommandListener,
        registerStatusListener
      }}
    >
      {children}
    </MqttContext.Provider>
  );
};
