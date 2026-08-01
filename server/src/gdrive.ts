import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, addLog } from './db.js';
import { Audio, SyncStatus } from './types.js';
import { v4 as uuidv4 } from 'uuid';

const cacheDir = path.resolve(__dirname, '../cache');
const mockDriveDir = path.resolve(__dirname, '../mock_drive');

// Helper to ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (!fs.existsSync(mockDriveDir)) {
    fs.mkdirSync(mockDriveDir, { recursive: true });
  }
}

// Generate MD5 checksum of a file
function calculateMd5(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

export type SyncProgressCallback = (status: SyncStatus) => void;

export async function syncAudioFiles(onProgress: SyncProgressCallback): Promise<void> {
  ensureDirs();
  const db = await getDb();

  // Get Google Drive settings
  const folderIdSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_folder_id']);
  const folderId = folderIdSetting ? folderIdSetting.value : '';

  // Get service account credentials from database setting or env
  const serviceAccountSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['gdrive_credentials']);
  const serviceAccountJson = serviceAccountSetting ? serviceAccountSetting.value : process.env.GDRIVE_CREDENTIALS || '';

  const isMockMode = !folderId || !serviceAccountJson;

  if (isMockMode) {
    console.log('Running Sync in MOCK MODE (Syncing local mock_drive/ with cache/)');
    await syncMockDrive(onProgress);
  } else {
    console.log('Running Sync in LIVE GOOGLE DRIVE MODE');
    await syncLiveDrive(folderId, serviceAccountJson, onProgress);
  }
}

// ==========================================
// MOCK GOOGLE DRIVE SYNC IMPLEMENTATION
// ==========================================
async function syncMockDrive(onProgress: SyncProgressCallback): Promise<void> {
  const db = await getDb();
  onProgress({
    status: 'syncing',
    progress: 0,
    message: 'Memulai sinkronisasi lokal (Mock Mode)...',
    totalFiles: 0,
    processedFiles: 0
  });

  try {
    // List all files in mock_drive
    const files = fs.readdirSync(mockDriveDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
    });

    const totalFiles = files.length;
    if (totalFiles === 0) {
      await addLog('Sync', 'Sinkronisasi selesai (Mock Mode). Tidak ada file ditemukan di mock_drive/.');
      onProgress({
        status: 'success',
        progress: 100,
        message: 'Sinkronisasi selesai. mock_drive/ kosong. Harap tambahkan file audio ke folder mock_drive/!',
        totalFiles: 0,
        processedFiles: 0
      });
      return;
    }

    let processedFiles = 0;
    const driveIdsInMock: string[] = [];

    for (const filename of files) {
      const mockFilePath = path.join(mockDriveDir, filename);
      const stat = fs.statSync(mockFilePath);
      const modifiedTime = stat.mtime.toISOString();
      const checksum = calculateMd5(mockFilePath);
      
      // Use filename as a deterministic drive_id for mock mode
      const driveId = `mock_${filename}`;
      driveIdsInMock.push(driveId);

      onProgress({
        status: 'syncing',
        progress: Math.round((processedFiles / totalFiles) * 100),
        message: `Menganalisis file: ${filename}...`,
        totalFiles,
        processedFiles
      });

      // Check if file exists in SQLite
      const existingAudio = await db.get('SELECT * FROM audio WHERE drive_id = ?', [driveId]);
      const cacheFilePath = path.join(cacheDir, filename);

      let shouldCopy = false;

      if (!existingAudio) {
        shouldCopy = true;
      } else if (existingAudio.checksum !== checksum || existingAudio.modified_time !== modifiedTime || !fs.existsSync(cacheFilePath)) {
        shouldCopy = true;
      }

      if (shouldCopy) {
        // Copy file to cache
        fs.copyFileSync(mockFilePath, cacheFilePath);

        // Get category based on prefix or default
        const kategori = detectCategory(filename);

        if (!existingAudio) {
          // Insert new record
          await db.run(
            `INSERT INTO audio (id, drive_id, nama, kategori, local_path, volume, fade, favorite, checksum, modified_time, duration, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              uuidv4(),
              driveId,
              path.parse(filename).name,
              kategori,
              filename,
              1.0,
              1,
              0,
              checksum,
              modifiedTime,
              0.0 // Duration will be calculated on client load
            ]
          );
          await addLog('Sync Add', `Menambahkan file: ${filename}`);
        } else {
          // Update existing record
          await db.run(
            `UPDATE audio SET nama = ?, kategori = ?, local_path = ?, checksum = ?, modified_time = ?, updated_at = CURRENT_TIMESTAMP WHERE drive_id = ?`,
            [
              path.parse(filename).name,
              kategori,
              filename,
              checksum,
              modifiedTime,
              driveId
            ]
          );
          await addLog('Sync Update', `Memperbarui file: ${filename}`);
        }
      }

      processedFiles++;
      onProgress({
        status: 'syncing',
        progress: Math.round((processedFiles / totalFiles) * 100),
        message: `Diproses: ${filename}`,
        totalFiles,
        processedFiles
      });
    }

    // Clean up local cache/database audios that are deleted from mock_drive
    const allAudios = await db.all('SELECT * FROM audio WHERE drive_id LIKE "mock_%"');
    for (const audio of allAudios) {
      if (audio.drive_id && !driveIdsInMock.includes(audio.drive_id)) {
        // Remove file from cache
        const filePath = path.join(cacheDir, audio.local_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        // Remove from db
        await db.run('DELETE FROM audio WHERE id = ?', [audio.id]);
        await addLog('Sync Delete', `Menghapus file yang hilang: ${audio.local_path}`);
      }
    }

    await addLog('Sync', `Sinkronisasi selesai (Mock Mode). Total file: ${totalFiles}`);
    onProgress({
      status: 'success',
      progress: 100,
      message: 'Sinkronisasi berhasil diselesaikan!',
      totalFiles,
      processedFiles: totalFiles
    });
  } catch (error: any) {
    console.error('Error during mock sync:', error);
    await addLog('Sync Error', `Gagal sinkronisasi: ${error.message}`);
    onProgress({
      status: 'error',
      progress: 100,
      message: `Gagal Sinkronisasi: ${error.message}`,
      totalFiles: 0,
      processedFiles: 0
    });
  }
}

// ==========================================
// LIVE GOOGLE DRIVE SYNC IMPLEMENTATION
// ==========================================
async function syncLiveDrive(
  folderId: string,
  credentialsJson: string,
  onProgress: SyncProgressCallback
): Promise<void> {
  const db = await getDb();
  onProgress({
    status: 'syncing',
    progress: 0,
    message: 'Menghubungkan ke Google Drive...',
    totalFiles: 0,
    processedFiles: 0
  });

  try {
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    const drive = google.drive({ version: 'v3', auth });

    onProgress({
      status: 'syncing',
      progress: 10,
      message: 'Membaca daftar file dari Google Drive...',
      totalFiles: 0,
      processedFiles: 0
    });

    // List files in the specified folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType type 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.ogg' or name contains '.m4a')`,
      fields: 'files(id, name, md5Checksum, modifiedTime, size)',
      pageSize: 1000
    });

    const files = response.data.files || [];
    const totalFiles = files.length;

    if (totalFiles === 0) {
      await addLog('Sync', 'Sinkronisasi selesai (Live GDrive). Tidak ada file audio di folder Drive.');
      onProgress({
        status: 'success',
        progress: 100,
        message: 'Sinkronisasi selesai. Folder Google Drive kosong.',
        totalFiles: 0,
        processedFiles: 0
      });
      return;
    }

    let processedFiles = 0;
    const driveIdsInCloud: string[] = [];

    for (const file of files) {
      const driveId = file.id!;
      const filename = file.name!;
      const checksum = file.md5Checksum || '';
      const modifiedTime = file.modifiedTime || '';

      driveIdsInCloud.push(driveId);

      onProgress({
        status: 'syncing',
        progress: Math.round((processedFiles / totalFiles) * 100),
        message: `Memeriksa: ${filename}...`,
        totalFiles,
        processedFiles
      });

      // Check database
      const existingAudio = await db.get('SELECT * FROM audio WHERE drive_id = ?', [driveId]);
      const cacheFilePath = path.join(cacheDir, filename);

      let shouldDownload = false;

      if (!existingAudio) {
        shouldDownload = true;
      } else if (existingAudio.checksum !== checksum || existingAudio.modified_time !== modifiedTime || !fs.existsSync(cacheFilePath)) {
        shouldDownload = true;
      }

      if (shouldDownload) {
        onProgress({
          status: 'syncing',
          progress: Math.round((processedFiles / totalFiles) * 100),
          message: `Mengunduh file: ${filename}...`,
          totalFiles,
          processedFiles
        });

        // Download file from Drive
        const dest = fs.createWriteStream(cacheFilePath);
        const fileStream = await drive.files.get(
          { fileId: driveId, alt: 'media' },
          { responseType: 'stream' }
        );

        await new Promise<void>((resolve, reject) => {
          fileStream.data
            .on('error', reject)
            .pipe(dest)
            .on('error', reject)
            .on('finish', resolve);
        });

        const kategori = detectCategory(filename);

        if (!existingAudio) {
          await db.run(
            `INSERT INTO audio (id, drive_id, nama, kategori, local_path, volume, fade, favorite, checksum, modified_time, duration, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              uuidv4(),
              driveId,
              path.parse(filename).name,
              kategori,
              filename,
              1.0,
              1,
              0,
              checksum,
              modifiedTime,
              0.0
            ]
          );
          await addLog('Sync Add', `Menambahkan dari Drive: ${filename}`);
        } else {
          await db.run(
            `UPDATE audio SET nama = ?, kategori = ?, local_path = ?, checksum = ?, modified_time = ?, updated_at = CURRENT_TIMESTAMP WHERE drive_id = ?`,
            [
              path.parse(filename).name,
              kategori,
              filename,
              checksum,
              modifiedTime,
              driveId
            ]
          );
          await addLog('Sync Update', `Memperbarui dari Drive: ${filename}`);
        }
      }

      processedFiles++;
      onProgress({
        status: 'syncing',
        progress: Math.round((processedFiles / totalFiles) * 100),
        message: `Diproses: ${filename}`,
        totalFiles,
        processedFiles
      });
    }

    // Clean up local cache/database files deleted from Google Drive
    const allDriveAudios = await db.all('SELECT * FROM audio WHERE drive_id IS NOT NULL AND drive_id NOT LIKE "mock_%"');
    for (const audio of allDriveAudios) {
      if (audio.drive_id && !driveIdsInCloud.includes(audio.drive_id)) {
        const filePath = path.join(cacheDir, audio.local_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await db.run('DELETE FROM audio WHERE id = ?', [audio.id]);
        await addLog('Sync Delete', `Menghapus file yang terhapus di Drive: ${audio.local_path}`);
      }
    }

    await addLog('Sync', `Sinkronisasi Live Google Drive selesai. Total file: ${totalFiles}`);
    onProgress({
      status: 'success',
      progress: 100,
      message: 'Sinkronisasi dengan Google Drive berhasil diselesaikan!',
      totalFiles,
      processedFiles: totalFiles
    });
  } catch (error: any) {
    console.error('Error during Live Drive sync:', error);
    await addLog('Sync Error', `Gagal sinkronisasi Drive: ${error.message}`);
    onProgress({
      status: 'error',
      progress: 100,
      message: `Gagal Sinkronisasi Google Drive: ${error.message}`,
      totalFiles: 0,
      processedFiles: 0
    });
  }
}

// Auto-detect category based on filename keywords
function detectCategory(filename: string): Audio['kategori'] {
  const name = filename.toLowerCase();
  if (name.includes('opening') || name.includes('intro') || name.startsWith('op_')) {
    return 'Opening';
  } else if (name.includes('mars') || name.includes('anthem') || name.startsWith('mars_')) {
    return 'Mars';
  } else if (name.includes('sholawat') || name.includes('shalawat') || name.includes('shl_')) {
    return 'Sholawat';
  } else if (name.includes('closing') || name.includes('outro') || name.startsWith('cl_')) {
    return 'Closing';
  } else if (name.includes('instrumen') || name.includes('instrument') || name.includes('bgm') || name.startsWith('bg_')) {
    return 'Instrument';
  } else {
    // Default to Efek (sound effects) if none match, as soundboard effects are common
    return 'Efek';
  }
}
