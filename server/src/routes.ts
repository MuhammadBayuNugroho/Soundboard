import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { google } from 'googleapis';

import { getDb, addLog } from './db.js';
import { authenticateToken, AuthenticatedRequest, getJwtSecret } from './middleware.js';
import { syncAudioFiles } from './gdrive.js';
import { Audio } from './types.js';

// Setup file upload directories
const uploadDir = path.resolve(__dirname, '../uploads');
const cacheDir = path.resolve(__dirname, '../cache');
const mockDriveDir = path.resolve(__dirname, '../mock_drive');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(mockDriveDir)) fs.mkdirSync(mockDriveDir, { recursive: true });

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original file name for clean display
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

export const router = Router();

// Hook to emit Socket.IO sync status
let ioInstance: any = null;
export function setIoInstance(io: any) {
  ioInstance = io;
}

// Helper to calculate file MD5 checksum
function calculateFileMd5(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username dan Password wajib diisi.' });
    return;
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      res.status(401).json({ error: 'Username atau Password salah.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Username atau Password salah.' });
      return;
    }

    const secret = await getJwtSecret();
    const token = jwt.sign({ username: user.username }, secret, { expiresIn: '7d' });

    await addLog('Login', `Operator '${username}' berhasil login`);
    res.json({ token, username: user.username });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ username: req.user?.username });
});

// ----------------------------------------------------
// AUDIO ENDPOINTS
// ----------------------------------------------------
router.get('/audio', async (req, res) => {
  try {
    const db = await getDb();
    const audios = await db.all('SELECT * FROM audio ORDER BY kategori ASC, nama ASC');
    res.json(audios);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add new Audio (with file upload)
router.post('/audio', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
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
    const db = await getDb();
    const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
    const folderId = folderIdSetting ? folderIdSetting.value : '';

    const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
    const credentialsJson = credentialsSetting ? credentialsSetting.value : '';

    const isMockMode = !folderId || !credentialsJson;
    
    // Set destination local filename in cache/ folder
    const targetFilename = Date.now() + '-' + originalName;
    const destCachePath = path.join(cacheDir, targetFilename);

    let driveId = `mock_${targetFilename}`;

    if (isMockMode) {
      // Mock Mode: copy to mock_drive and cache directly
      const destMockPath = path.join(mockDriveDir, targetFilename);
      fs.copyFileSync(tempPath, destMockPath);
      fs.copyFileSync(tempPath, destCachePath);
      fs.unlinkSync(tempPath); // remove temp upload
    } else {
      // Live Google Drive Mode: Upload to Google Drive
      const credentials = JSON.parse(credentialsJson);
      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
      );

      const drive = google.drive({ version: 'v3', auth });
      const driveResponse = await drive.files.create({
        requestBody: {
          name: targetFilename,
          parents: [folderId]
        },
        media: {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(tempPath)
        },
        fields: 'id'
      });

      driveId = driveResponse.data.id || driveId;
      
      // Copy upload to cache
      fs.copyFileSync(tempPath, destCachePath);
      fs.unlinkSync(tempPath); // remove temp upload
    }

    const audioId = uuidv4();
    await db.run(
      `INSERT INTO audio (id, drive_id, nama, kategori, local_path, volume, fade, favorite, shortcut, checksum, modified_time, duration, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        audioId,
        driveId,
        nama || path.parse(originalName).name,
        kategori || 'Efek',
        targetFilename,
        parseFloat(volume) || 1.0,
        parseInt(fade) || 1,
        parseInt(favorite) || 0,
        shortcut || null,
        checksum,
        modifiedTime,
        0.0 // Duration will be filled by frontend player later
      ]
    );

    await addLog('Audio Add', `Berhasil mengunggah audio: ${nama || originalName}`);
    
    // Notify clients that audios list changed
    if (ioInstance) {
      ioInstance.emit('audio-changed');
    }

    const newAudio = await db.get('SELECT * FROM audio WHERE id = ?', [audioId]);
    res.status(201).json(newAudio);
  } catch (error: any) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update Audio metadata
router.put('/audio/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { nama, kategori, volume, fade, shortcut, favorite } = req.body;

  try {
    const db = await getDb();
    const existing = await db.get('SELECT * FROM audio WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Audio tidak ditemukan.' });
      return;
    }

    await db.run(
      `UPDATE audio SET nama = ?, kategori = ?, volume = ?, fade = ?, shortcut = ?, favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        nama !== undefined ? nama : existing.nama,
        kategori !== undefined ? kategori : existing.kategori,
        volume !== undefined ? parseFloat(volume) : existing.volume,
        fade !== undefined ? parseInt(fade) : existing.fade,
        shortcut !== undefined ? shortcut : existing.shortcut,
        favorite !== undefined ? parseInt(favorite) : existing.favorite,
        id
      ]
    );

    await addLog('Audio Update', `Memperbarui metadata audio: ${nama || existing.nama}`);
    
    if (ioInstance) {
      ioInstance.emit('audio-changed');
    }

    const updated = await db.get('SELECT * FROM audio WHERE id = ?', [id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Audio Duration (sent by client on preload)
router.post('/audio/:id/duration', async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body;

  if (duration === undefined) {
    res.status(400).json({ error: 'Durasi wajib diisi.' });
    return;
  }

  try {
    const db = await getDb();
    await db.run('UPDATE audio SET duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      parseFloat(duration),
      id
    ]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Audio
router.delete('/audio/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    const audio = await db.get('SELECT * FROM audio WHERE id = ?', [id]) as Audio | undefined;
    if (!audio) {
      res.status(404).json({ error: 'Audio tidak ditemukan.' });
      return;
    }

    // Delete local cache file
    const cacheFilePath = path.join(cacheDir, audio.local_path);
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }

    // Delete mock_drive file if in mock mode
    if (audio.drive_id?.startsWith('mock_')) {
      const mockFilePath = path.join(mockDriveDir, audio.local_path);
      if (fs.existsSync(mockFilePath)) {
        fs.unlinkSync(mockFilePath);
      }
    } else if (audio.drive_id) {
      // In live GDrive mode, optionally delete file from Drive
      try {
        const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
        const folderId = folderIdSetting ? folderIdSetting.value : '';
        const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
        const credentialsJson = credentialsSetting ? credentialsSetting.value : '';

        if (folderId && credentialsJson) {
          const credentials = JSON.parse(credentialsJson);
          const auth = new google.auth.JWT(
            credentials.client_email,
            undefined,
            credentials.private_key,
            ['https://www.googleapis.com/auth/drive']
          );
          const drive = google.drive({ version: 'v3', auth });
          await drive.files.delete({ fileId: audio.drive_id });
        }
      } catch (gdriveErr) {
        console.error('Failed to delete file from Google Drive:', gdriveErr);
      }
    }

    // Delete from Database
    await db.run('DELETE FROM audio WHERE id = ?', [id]);
    await addLog('Audio Delete', `Menghapus audio: ${audio.nama}`);
    
    if (ioInstance) {
      ioInstance.emit('audio-changed');
    }

    res.json({ success: true, message: `Audio ${audio.nama} berhasil dihapus.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// SETTINGS ENDPOINTS
// ----------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const db = await getDb();
    const settingsList = await db.all('SELECT * FROM settings');
    const settingsMap: Record<string, string> = {};
    settingsList.forEach(s => {
      // Exclude sensitive service credentials string for security
      if (s.key === 'gdrive_credentials' && s.value) {
        settingsMap[s.key] = 'configured';
      } else {
        settingsMap[s.key] = s.value;
      }
    });
    res.json(settingsMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const settingsObj = req.body;

  try {
    const db = await getDb();
    for (const [key, val] of Object.entries(settingsObj)) {
      // Avoid overwriting credentials if they are hidden as 'configured'
      if (key === 'gdrive_credentials' && val === 'configured') {
        continue;
      }
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, val]
      );
    }
    
    await addLog('Settings Change', 'Mengubah pengaturan sistem');
    
    if (ioInstance) {
      ioInstance.emit('settings-changed');
    }

    res.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// LOGS ENDPOINTS
// ----------------------------------------------------
router.get('/logs', async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500');
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// SINKRONISASI TRIGGER
// ----------------------------------------------------
router.post('/sync', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!ioInstance) {
      res.status(500).json({ error: 'Socket.IO server belum siap.' });
      return;
    }

    // Run sync in the background
    syncAudioFiles((status) => {
      // Broadcast progress via Socket.IO
      ioInstance.emit('sync-progress', status);
    }).then(() => {
      ioInstance.emit('audio-changed');
    });

    res.json({ success: true, message: 'Sinkronisasi dimulai di latar belakang.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sync/stats', async (req, res) => {
  try {
    const db = await getDb();
    
    const dbCountResult = await db.get('SELECT COUNT(*) as count FROM audio');
    const totalDbCount = dbCountResult ? dbCountResult.count : 0;
    
    const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
    const folderId = folderIdSetting ? folderIdSetting.value : '';
    const credentialsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
    const credentialsJson = credentialsSetting ? credentialsSetting.value : '';
    
    const mode = (folderId && credentialsJson) ? 'LIVE GOOGLE DRIVE' : 'MOCK LOCAL DRIVE';
    
    let cachedFileCount = 0;
    let cacheSizeMb = 0;
    
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir).filter(f => !fs.statSync(path.join(cacheDir, f)).isDirectory());
      cachedFileCount = files.length;
      let totalBytes = 0;
      files.forEach(f => {
        try {
          const stat = fs.statSync(path.join(cacheDir, f));
          totalBytes += stat.size;
        } catch (_) {}
      });
      cacheSizeMb = totalBytes / (1024 * 1024);
    }
    
    const lastSyncLog = await db.get(
      "SELECT timestamp FROM logs WHERE action = 'Sync' ORDER BY timestamp DESC LIMIT 1"
    );
    const lastSyncTime = lastSyncLog ? lastSyncLog.timestamp : null;
    
    res.json({
      mode,
      folderId,
      totalDbCount,
      cachedFileCount,
      cacheSizeMb,
      lastSyncTime
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

