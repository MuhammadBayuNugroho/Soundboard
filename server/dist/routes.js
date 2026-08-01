"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
exports.setIoInstance = setIoInstance;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const googleapis_1 = require("googleapis");
const db_js_1 = require("./db.js");
const middleware_js_1 = require("./middleware.js");
const gdrive_js_1 = require("./gdrive.js");
// Setup file upload directories
const uploadDir = path_1.default.resolve(__dirname, '../uploads');
const cacheDir = path_1.default.resolve(__dirname, '../cache');
const mockDriveDir = path_1.default.resolve(__dirname, '../mock_drive');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
if (!fs_1.default.existsSync(cacheDir))
    fs_1.default.mkdirSync(cacheDir, { recursive: true });
if (!fs_1.default.existsSync(mockDriveDir))
    fs_1.default.mkdirSync(mockDriveDir, { recursive: true });
// Configure Multer
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Keep original file name for clean display
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
exports.router = (0, express_1.Router)();
// Hook to emit Socket.IO sync status
let ioInstance = null;
function setIoInstance(io) {
    ioInstance = io;
}
// Helper to calculate file MD5 checksum
function calculateFileMd5(filePath) {
    const fileBuffer = fs_1.default.readFileSync(filePath);
    const hashSum = crypto_1.default.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
exports.router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ error: 'Username dan Password wajib diisi.' });
        return;
    }
    try {
        const db = await (0, db_js_1.getDb)();
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            res.status(401).json({ error: 'Username atau Password salah.' });
            return;
        }
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ error: 'Username atau Password salah.' });
            return;
        }
        const secret = await (0, middleware_js_1.getJwtSecret)();
        const token = jsonwebtoken_1.default.sign({ username: user.username }, secret, { expiresIn: '7d' });
        await (0, db_js_1.addLog)('Login', `Operator '${username}' berhasil login`);
        res.json({ token, username: user.username });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.router.get('/auth/me', middleware_js_1.authenticateToken, (req, res) => {
    res.json({ username: req.user?.username });
});
// ----------------------------------------------------
// AUDIO ENDPOINTS
// ----------------------------------------------------
exports.router.get('/audio', async (req, res) => {
    try {
        const db = await (0, db_js_1.getDb)();
        const audios = await db.all('SELECT * FROM audio ORDER BY kategori ASC, nama ASC');
        res.json(audios);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add new Audio (with file upload)
exports.router.post('/audio', middleware_js_1.authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'File audio wajib diunggah.' });
        return;
    }
    const { nama, kategori, volume, fade, shortcut, favorite } = req.body;
    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const checksum = calculateFileMd5(tempPath);
    const modifiedTime = new Date().toISOString();
    try {
        const db = await (0, db_js_1.getDb)();
        const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
        const folderId = folderIdSetting ? folderIdSetting.value : '';
        const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
        const credentialsJson = credentialsSetting ? credentialsSetting.value : '';
        const isMockMode = !folderId || !credentialsJson;
        // Set destination local filename in cache/ folder
        const targetFilename = Date.now() + '-' + originalName;
        const destCachePath = path_1.default.join(cacheDir, targetFilename);
        let driveId = `mock_${targetFilename}`;
        if (isMockMode) {
            // Mock Mode: copy to mock_drive and cache directly
            const destMockPath = path_1.default.join(mockDriveDir, targetFilename);
            fs_1.default.copyFileSync(tempPath, destMockPath);
            fs_1.default.copyFileSync(tempPath, destCachePath);
            fs_1.default.unlinkSync(tempPath); // remove temp upload
        }
        else {
            // Live Google Drive Mode: Upload to Google Drive
            const credentials = JSON.parse(credentialsJson);
            const auth = new googleapis_1.google.auth.JWT(credentials.client_email, undefined, credentials.private_key, ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']);
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const driveResponse = await drive.files.create({
                requestBody: {
                    name: targetFilename,
                    parents: [folderId]
                },
                media: {
                    mimeType: req.file.mimetype,
                    body: fs_1.default.createReadStream(tempPath)
                },
                fields: 'id'
            });
            driveId = driveResponse.data.id || driveId;
            // Copy upload to cache
            fs_1.default.copyFileSync(tempPath, destCachePath);
            fs_1.default.unlinkSync(tempPath); // remove temp upload
        }
        const audioId = (0, uuid_1.v4)();
        await db.run(`INSERT INTO audio (id, drive_id, nama, kategori, local_path, volume, fade, favorite, shortcut, checksum, modified_time, duration, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [
            audioId,
            driveId,
            nama || path_1.default.parse(originalName).name,
            kategori || 'Efek',
            targetFilename,
            parseFloat(volume) || 1.0,
            parseInt(fade) || 1,
            parseInt(favorite) || 0,
            shortcut || null,
            checksum,
            modifiedTime,
            0.0 // Duration will be filled by frontend player later
        ]);
        await (0, db_js_1.addLog)('Audio Add', `Berhasil mengunggah audio: ${nama || originalName}`);
        // Notify clients that audios list changed
        if (ioInstance) {
            ioInstance.emit('audio-changed');
        }
        const newAudio = await db.get('SELECT * FROM audio WHERE id = ?', [audioId]);
        res.status(201).json(newAudio);
    }
    catch (error) {
        if (fs_1.default.existsSync(tempPath))
            fs_1.default.unlinkSync(tempPath);
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// Update Audio metadata
exports.router.put('/audio/:id', middleware_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nama, kategori, volume, fade, shortcut, favorite } = req.body;
    try {
        const db = await (0, db_js_1.getDb)();
        const existing = await db.get('SELECT * FROM audio WHERE id = ?', [id]);
        if (!existing) {
            res.status(404).json({ error: 'Audio tidak ditemukan.' });
            return;
        }
        await db.run(`UPDATE audio SET nama = ?, kategori = ?, volume = ?, fade = ?, shortcut = ?, favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
            nama !== undefined ? nama : existing.nama,
            kategori !== undefined ? kategori : existing.kategori,
            volume !== undefined ? parseFloat(volume) : existing.volume,
            fade !== undefined ? parseInt(fade) : existing.fade,
            shortcut !== undefined ? shortcut : existing.shortcut,
            favorite !== undefined ? parseInt(favorite) : existing.favorite,
            id
        ]);
        await (0, db_js_1.addLog)('Audio Update', `Memperbarui metadata audio: ${nama || existing.nama}`);
        if (ioInstance) {
            ioInstance.emit('audio-changed');
        }
        const updated = await db.get('SELECT * FROM audio WHERE id = ?', [id]);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update Audio Duration (sent by client on preload)
exports.router.post('/audio/:id/duration', async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body;
    if (duration === undefined) {
        res.status(400).json({ error: 'Durasi wajib diisi.' });
        return;
    }
    try {
        const db = await (0, db_js_1.getDb)();
        await db.run('UPDATE audio SET duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            parseFloat(duration),
            id
        ]);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete Audio
exports.router.delete('/audio/:id', middleware_js_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const db = await (0, db_js_1.getDb)();
        const audio = await db.get('SELECT * FROM audio WHERE id = ?', [id]);
        if (!audio) {
            res.status(404).json({ error: 'Audio tidak ditemukan.' });
            return;
        }
        // Delete local cache file
        const cacheFilePath = path_1.default.join(cacheDir, audio.local_path);
        if (fs_1.default.existsSync(cacheFilePath)) {
            fs_1.default.unlinkSync(cacheFilePath);
        }
        // Delete mock_drive file if in mock mode
        if (audio.drive_id?.startsWith('mock_')) {
            const mockFilePath = path_1.default.join(mockDriveDir, audio.local_path);
            if (fs_1.default.existsSync(mockFilePath)) {
                fs_1.default.unlinkSync(mockFilePath);
            }
        }
        else if (audio.drive_id) {
            // In live GDrive mode, optionally delete file from Drive
            try {
                const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
                const folderId = folderIdSetting ? folderIdSetting.value : '';
                const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
                const credentialsJson = credentialsSetting ? credentialsSetting.value : '';
                if (folderId && credentialsJson) {
                    const credentials = JSON.parse(credentialsJson);
                    const auth = new googleapis_1.google.auth.JWT(credentials.client_email, undefined, credentials.private_key, ['https://www.googleapis.com/auth/drive']);
                    const drive = googleapis_1.google.drive({ version: 'v3', auth });
                    await drive.files.delete({ fileId: audio.drive_id });
                }
            }
            catch (gdriveErr) {
                console.error('Failed to delete file from Google Drive:', gdriveErr);
            }
        }
        // Delete from Database
        await db.run('DELETE FROM audio WHERE id = ?', [id]);
        await (0, db_js_1.addLog)('Audio Delete', `Menghapus audio: ${audio.nama}`);
        if (ioInstance) {
            ioInstance.emit('audio-changed');
        }
        res.json({ success: true, message: `Audio ${audio.nama} berhasil dihapus.` });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ----------------------------------------------------
// SETTINGS ENDPOINTS
// ----------------------------------------------------
exports.router.get('/settings', async (req, res) => {
    try {
        const db = await (0, db_js_1.getDb)();
        const settingsList = await db.all('SELECT * FROM settings');
        const settingsMap = {};
        settingsList.forEach(s => {
            // Exclude sensitive service credentials string for security
            if (s.key === 'gdrive_credentials' && s.value) {
                settingsMap[s.key] = 'configured';
            }
            else {
                settingsMap[s.key] = s.value;
            }
        });
        res.json(settingsMap);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.router.post('/settings', middleware_js_1.authenticateToken, async (req, res) => {
    const settingsObj = req.body;
    try {
        const db = await (0, db_js_1.getDb)();
        for (const [key, val] of Object.entries(settingsObj)) {
            // Avoid overwriting credentials if they are hidden as 'configured'
            if (key === 'gdrive_credentials' && val === 'configured') {
                continue;
            }
            await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, val]);
        }
        await (0, db_js_1.addLog)('Settings Change', 'Mengubah pengaturan sistem');
        if (ioInstance) {
            ioInstance.emit('settings-changed');
        }
        res.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ----------------------------------------------------
// LOGS ENDPOINTS
// ----------------------------------------------------
exports.router.get('/logs', async (req, res) => {
    try {
        const db = await (0, db_js_1.getDb)();
        const logs = await db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500');
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ----------------------------------------------------
// SINKRONISASI TRIGGER
// ----------------------------------------------------
exports.router.post('/sync', middleware_js_1.authenticateToken, async (req, res) => {
    try {
        if (!ioInstance) {
            res.status(500).json({ error: 'Socket.IO server belum siap.' });
            return;
        }
        // Run sync in the background
        (0, gdrive_js_1.syncAudioFiles)((status) => {
            // Broadcast progress via Socket.IO
            ioInstance.emit('sync-progress', status);
        }).then(() => {
            ioInstance.emit('audio-changed');
        });
        res.json({ success: true, message: 'Sinkronisasi dimulai di latar belakang.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.router.get('/sync/stats', async (req, res) => {
    try {
        const db = await (0, db_js_1.getDb)();
        const dbCountResult = await db.get('SELECT COUNT(*) as count FROM audio');
        const totalDbCount = dbCountResult ? dbCountResult.count : 0;
        const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
        const folderId = folderIdSetting ? folderIdSetting.value : '';
        const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
        const credentialsJson = credentialsSetting ? credentialsSetting.value : '';
        const mode = (folderId && credentialsJson) ? 'LIVE GOOGLE DRIVE' : 'MOCK LOCAL DRIVE';
        let cachedFileCount = 0;
        let cacheSizeMb = 0;
        if (fs_1.default.existsSync(cacheDir)) {
            const files = fs_1.default.readdirSync(cacheDir).filter(f => !fs_1.default.statSync(path_1.default.join(cacheDir, f)).isDirectory());
            cachedFileCount = files.length;
            let totalBytes = 0;
            files.forEach(f => {
                try {
                    const stat = fs_1.default.statSync(path_1.default.join(cacheDir, f));
                    totalBytes += stat.size;
                }
                catch (_) { }
            });
            cacheSizeMb = totalBytes / (1024 * 1024);
        }
        const lastSyncLog = await db.get("SELECT timestamp FROM logs WHERE action = 'Sync' ORDER BY timestamp DESC LIMIT 1");
        const lastSyncTime = lastSyncLog ? lastSyncLog.timestamp : null;
        res.json({
            mode,
            folderId,
            totalDbCount,
            cachedFileCount,
            cacheSizeMb,
            lastSyncTime
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
