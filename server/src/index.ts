import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { initDb, addLog } from './db.js';
import { router, setIoInstance } from './routes.js';
import { errorHandler } from './middleware.js';
import { DeviceClient } from './types.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Configure CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Set Socket.IO instance in routes for broadcasting sync updates
setIoInstance(io);

// Cache folder path
const cacheDir = path.resolve(__dirname, '../cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Serve cached audio files
app.use('/cache', express.static(cacheDir, {
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Mount API routes
app.use('/api', router);

// Serve static frontend in production
const clientDistDir = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('SACP Server is running. Frontend build not found.');
  });
}

// Error handling middleware
app.use(errorHandler);

// Socket.IO Connection Handling
let connectedDevices: DeviceClient[] = [];

io.on('connection', (socket) => {
  const ipAddress = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
  console.log(`New socket connection: ${socket.id} from ${ipAddress}`);

  socket.on('register-device', (data: { role: 'player' | 'remote' }) => {
    // Remove if already registered
    connectedDevices = connectedDevices.filter(d => d.socketId !== socket.id);

    const device: DeviceClient = {
      socketId: socket.id,
      role: data.role,
      userAgent,
      ipAddress,
      connectedAt: new Date().toISOString()
    };

    connectedDevices.push(device);
    console.log(`Registered device: ${socket.id} as ${device.role}`);

    // Broadcast updated device list to all
    io.emit('device-list', connectedDevices);
    
    // Log the device connection
    addLog('Connect', `Perangkat terhubung sebagai ${device.role === 'player' ? 'Desktop Player' : 'Mobile Remote'}`);
  });

  // Forward audio control triggers from Mobile Remote -> Desktop Player
  socket.on('trigger-play', (data: { id: string; volume?: number; fade?: boolean }) => {
    console.log(`Trigger PLAY: ${data.id}`);
    io.emit('play-audio', data);
  });

  socket.on('trigger-pause', (data: { id: string }) => {
    console.log(`Trigger PAUSE: ${data.id}`);
    io.emit('pause-audio', data);
  });

  socket.on('trigger-stop', (data: { id: string }) => {
    console.log(`Trigger STOP: ${data.id}`);
    io.emit('stop-audio', data);
  });

  socket.on('trigger-stop-all', () => {
    console.log('Trigger STOP ALL');
    io.emit('stop-all');
    addLog('Audio Control', 'Stop All dipicu oleh operator');
  });

  socket.on('trigger-set-volume', (data: { id: string; volume: number }) => {
    console.log(`Trigger VOLUME for ${data.id}: ${data.volume}`);
    io.emit('set-volume', data);
  });

  socket.on('trigger-master-volume', (data: { volume: number }) => {
    console.log(`Trigger MASTER VOLUME: ${data.volume}`);
    io.emit('master-volume', data);
  });

  socket.on('trigger-mute', (data: { mute: boolean }) => {
    console.log(`Trigger MUTE: ${data.mute}`);
    io.emit('mute', data);
  });

  socket.on('disconnect', () => {
    const device = connectedDevices.find(d => d.socketId === socket.id);
    if (device) {
      connectedDevices = connectedDevices.filter(d => d.socketId !== socket.id);
      io.emit('device-list', connectedDevices);
      addLog('Disconnect', `Perangkat ${device.role === 'player' ? 'Desktop Player' : 'Mobile Remote'} terputus`);
      console.log(`Device disconnected: ${socket.id} (${device.role})`);
    }
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
async function startServer() {
  await initDb();
  httpServer.listen(PORT, () => {
    console.log(`SACP Server is running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
