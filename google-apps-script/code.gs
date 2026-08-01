// ==========================================
// STAGE AUDIO CONTROL PANEL (SACP)
// Google Apps Script Web App API Backend
// ==========================================

// Auto-initialize sheets on first load
function initDb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Audio Sheet
  let audioSheet = ss.getSheetByName('Audio');
  if (!audioSheet) {
    audioSheet = ss.insertSheet('Audio');
    audioSheet.appendRow(['id', 'drive_id', 'nama', 'kategori', 'volume', 'fade', 'favorite', 'shortcut', 'checksum', 'modified_time', 'duration']);
    audioSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  }
  
  // 2. Settings Sheet
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    settingsSheet.appendRow(['key', 'value']);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    
    // Seed initial settings
    settingsSheet.appendRow(['nama_acara', 'STAGE AUDIO CONTROL PANEL']);
    settingsSheet.appendRow(['volume_default', '1.0']);
    settingsSheet.appendRow(['mqtt_room_id', Math.random().toString(36).substring(2, 10).toUpperCase()]); // Random room code
    settingsSheet.appendRow(['auto_sync', '1']);
  }
  
  // 3. Logs Sheet
  let logsSheet = ss.getSheetByName('Logs');
  if (!logsSheet) {
    logsSheet = ss.insertSheet('Logs');
    logsSheet.appendRow(['timestamp', 'action', 'details']);
    logsSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
}

// Find or create Master folder in Google Drive
function getMasterFolder(folderId) {
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (_) {}
  }
  
  // Default fallback folder in Drive root
  const folderName = 'SACP_Audio_Master';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

// Helper to convert sheet rows to JSON objects
function sheetToJson(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx];
    });
    return obj;
  });
}

// GET REQUESTS GATEWAY
function doGet(e) {
  initDb();
  const action = e.parameter.action;
  let result = null;
  
  try {
    if (action === 'getAudios') {
      result = sheetToJson('Audio');
    } else if (action === 'getSettings') {
      const settingsList = sheetToJson('Settings');
      const settingsMap = {};
      settingsList.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      result = settingsMap;
    } else if (action === 'getLogs') {
      result = sheetToJson('Logs').reverse().slice(0, 100); // latest 100 logs
    } else {
      result = { error: 'Aksi GET tidak valid' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST REQUESTS GATEWAY
function doPost(e) {
  initDb();
  let result = null;
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'downloadAudio') {
      const fileId = postData.id;
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      result = { base64: base64 };
    } else if (action === 'addAudio') {
      // Create file in Drive
      const folder = getMasterFolder(postData.folder_id);
      const decodedBytes = Utilities.base64Decode(postData.file_base64);
      const blob = Utilities.newBlob(decodedBytes, postData.mime_type, postData.filename);
      const driveFile = folder.createFile(blob);
      
      // Make accessible publicly so client browser can download directly
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      const audioId = Utilities.getUuid();
      const driveId = driveFile.getId();
      const checksum = driveFile.getBlob().getHash(); // MD5 hash representation
      const modifiedTime = driveFile.getLastUpdated().toISOString();
      
      // Insert to Audio Sheet
      const audioSheet = ss.getSheetByName('Audio');
      audioSheet.appendRow([
        audioId,
        driveId,
        postData.nama || postData.filename.replace(/\.[^/.]+$/, ""),
        postData.kategori || 'Efek',
        postData.volume || 1.0,
        postData.fade ? 1 : 0,
        postData.favorite ? 1 : 0,
        postData.shortcut || '',
        checksum,
        modifiedTime,
        0.0 // Duration calculated by frontend
      ]);
      
      // Write log
      writeLog('Audio Add', 'Mengunggah audio baru: ' + postData.nama);
      
      result = { success: true, id: audioId, drive_id: driveId };
      
    } else if (action === 'editAudio') {
      const audioSheet = ss.getSheetByName('Audio');
      const data = audioSheet.getDataRange().getValues();
      const id = postData.id;
      let foundRow = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        // columns: id, drive_id, nama, kategori, volume, fade, favorite, shortcut, checksum, modified_time, duration
        audioSheet.getRange(foundRow, 3).setValue(postData.nama);
        audioSheet.getRange(foundRow, 4).setValue(postData.kategori);
        audioSheet.getRange(foundRow, 5).setValue(postData.volume);
        audioSheet.getRange(foundRow, 6).setValue(postData.fade ? 1 : 0);
        audioSheet.getRange(foundRow, 7).setValue(postData.favorite ? 1 : 0);
        audioSheet.getRange(foundRow, 8).setValue(postData.shortcut || '');
        
        writeLog('Audio Edit', 'Mengedit metadata audio: ' + postData.nama);
        result = { success: true };
      } else {
        result = { error: 'Audio tidak ditemukan' };
      }
      
    } else if (action === 'updateDuration') {
      const audioSheet = ss.getSheetByName('Audio');
      const data = audioSheet.getDataRange().getValues();
      const id = postData.id;
      let foundRow = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        audioSheet.getRange(foundRow, 11).setValue(postData.duration);
        result = { success: true };
      } else {
        result = { error: 'Audio tidak ditemukan' };
      }
      
    } else if (action === 'deleteAudio') {
      const audioSheet = ss.getSheetByName('Audio');
      const data = audioSheet.getDataRange().getValues();
      const id = postData.id;
      let foundRow = -1;
      let driveId = '';
      let nama = '';
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          foundRow = i + 1;
          driveId = data[i][1];
          nama = data[i][2];
          break;
        }
      }
      
      if (foundRow !== -1) {
        // 1. Delete from Drive
        if (driveId) {
          try {
            DriveApp.getFileById(driveId).setTrashed(true);
          } catch (_) {}
        }
        
        // 2. Delete row from sheet
        audioSheet.deleteRow(foundRow);
        
        writeLog('Audio Delete', 'Menghapus audio: ' + nama);
        result = { success: true };
      } else {
        result = { error: 'Audio tidak ditemukan' };
      }
      
    } else if (action === 'saveSettings') {
      const settingsSheet = ss.getSheetByName('Settings');
      const settings = postData.settings;
      
      for (const [key, val] of Object.entries(settings)) {
        let foundRow = -1;
        const data = settingsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === key) {
            foundRow = i + 1;
            break;
          }
        }
        
        if (foundRow !== -1) {
          settingsSheet.getRange(foundRow, 2).setValue(val);
        } else {
          settingsSheet.appendRow([key, val]);
        }
      }
      
      writeLog('Settings Change', 'Mengubah pengaturan sistem');
      result = { success: true };
      
    } else if (action === 'addLog') {
      writeLog(postData.log_action, postData.log_details);
      result = { success: true };
    } else {
      result = { error: 'Aksi POST tidak valid' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Internal logging helper
function writeLog(action, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName('Logs');
  if (logsSheet) {
    const timestamp = new Date().toISOString();
    logsSheet.appendRow([timestamp, action, details || '']);
  }
}
