"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_js_1 = require("./db.js");
const routes_js_1 = require("./routes.js");
const middleware_js_1 = require("./middleware.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});
// Configure CORS and JSON parsing
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Set Socket.IO instance in routes for broadcasting sync updates
(0, routes_js_1.setIoInstance)(io);
// Cache folder path
const cacheDir = path_1.default.resolve(__dirname, '../cache');
if (!fs_1.default.existsSync(cacheDir)) {
    fs_1.default.mkdirSync(cacheDir, { recursive: true });
}
// Serve cached audio files
app.use('/cache', express_1.default.static(cacheDir, {
    setHeaders: (res) => {
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));
// Mount API routes
app.use('/api', routes_js_1.router);
// Serve static frontend in production
const clientDistDir = path_1.default.resolve(__dirname, '../../client/dist');
if (fs_1.default.existsSync(clientDistDir)) {
    app.use(express_1.default.static(clientDistDir));
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(clientDistDir, 'index.html'));
    });
}
else {
    app.get('/', (req, res) => {
        res.send('SACP Server is running. Frontend build not found.');
    });
}
// Error handling middleware
app.use(middleware_js_1.errorHandler);
// Socket.IO Connection Handling
let connectedDevices = [];
io.on('connection', (socket) => {
    const ipAddress = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    console.log(`New socket connection: ${socket.id} from ${ipAddress}`);
    socket.on('register-device', (data) => {
        // Remove if already registered
        connectedDevices = connectedDevices.filter(d => d.socketId !== socket.id);
        const device = {
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
        (0, db_js_1.addLog)('Connect', `Perangkat terhubung sebagai ${device.role === 'player' ? 'Desktop Player' : 'Mobile Remote'}`);
    });
    // Forward audio control triggers from Mobile Remote -> Desktop Player
    socket.on('trigger-play', (data) => {
        console.log(`Trigger PLAY: ${data.id}`);
        io.emit('play-audio', data);
    });
    socket.on('trigger-pause', (data) => {
        console.log(`Trigger PAUSE: ${data.id}`);
        io.emit('pause-audio', data);
    });
    socket.on('trigger-stop', (data) => {
        console.log(`Trigger STOP: ${data.id}`);
        io.emit('stop-audio', data);
    });
    socket.on('trigger-stop-all', () => {
        console.log('Trigger STOP ALL');
        io.emit('stop-all');
        (0, db_js_1.addLog)('Audio Control', 'Stop All dipicu oleh operator');
    });
    socket.on('trigger-set-volume', (data) => {
        console.log(`Trigger VOLUME for ${data.id}: ${data.volume}`);
        io.emit('set-volume', data);
    });
    socket.on('trigger-master-volume', (data) => {
        console.log(`Trigger MASTER VOLUME: ${data.volume}`);
        io.emit('master-volume', data);
    });
    socket.on('trigger-mute', (data) => {
        console.log(`Trigger MUTE: ${data.mute}`);
        io.emit('mute', data);
    });
    socket.on('disconnect', () => {
        const device = connectedDevices.find(d => d.socketId === socket.id);
        if (device) {
            connectedDevices = connectedDevices.filter(d => d.socketId !== socket.id);
            io.emit('device-list', connectedDevices);
            (0, db_js_1.addLog)('Disconnect', `Perangkat ${device.role === 'player' ? 'Desktop Player' : 'Mobile Remote'} terputus`);
            console.log(`Device disconnected: ${socket.id} (${device.role})`);
        }
    });
});
// Start Server
const PORT = process.env.PORT || 3000;
async function startServer() {
    await (0, db_js_1.initDb)();
    httpServer.listen(PORT, () => {
        console.log(`SACP Server is running on port ${PORT}`);
    });
}
startServer().catch(err => {
    console.error('Failed to start server:', err);
});
