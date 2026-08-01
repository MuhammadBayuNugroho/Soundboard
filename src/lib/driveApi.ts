// ============================================================
// Google Drive API v3 Wrapper
// Semua operasi CRUD file audio di folder "TheaterDeck"
// ============================================================

const FOLDER_NAME = 'TheaterSoundDeck'
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-m4a']

let _folderId: string | null = null

// ──────────────────────────────────────────────────────────
// GAPI Initialization
// ──────────────────────────────────────────────────────────

export async function initGapiClient(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        })
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  })
}

/** Set access token setelah login berhasil */
export function setAccessToken(token: string): void {
  gapi.client.setToken({ access_token: token })
}

// ──────────────────────────────────────────────────────────
// Folder Management
// ──────────────────────────────────────────────────────────

/** Cari atau buat folder "TheaterSoundDeck" di root Drive */
export async function ensureAppFolder(): Promise<string> {
  if (_folderId) return _folderId

  // Cari folder yang sudah ada
  const res = await (gapi.client as any).drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  })

  const files = (res.result as any).files as Array<{ id: string; name: string }>

  if (files && files.length > 0) {
    _folderId = files[0].id
    return _folderId
  }

  // Buat folder baru jika belum ada
  const createRes = await (gapi.client as any).drive.files.create({
    resource: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  } as any)

  _folderId = (createRes.result as any).id || ''
  return _folderId || ''
}

/** Reset folder ID cache (dipanggil setelah logout) */
export function resetFolderCache(): void {
  _folderId = null
}

// ──────────────────────────────────────────────────────────
// File Listing
// ──────────────────────────────────────────────────────────

export interface DriveFileInfo {
  id: string
  name: string
  fileName: string
  mimeType: string
  size: number
  modifiedTime: string
}

/** List semua file audio di folder TheaterSoundDeck */
export async function listTracks(): Promise<DriveFileInfo[]> {
  const folderId = await ensureAppFolder()

  const mimeQuery = AUDIO_MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ')
  const res = await (gapi.client as any).drive.files.list({
    q: `'${folderId}' in parents and (${mimeQuery}) and trashed=false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'name',
  } as any)

  const files = (res.result as any).files as Array<any> || []

  return files.map((f: any) => ({
    id: f.id,
    name: stripExtension(f.name),
    fileName: f.name,
    mimeType: f.mimeType,
    size: parseInt(f.size || '0'),
    modifiedTime: f.modifiedTime,
  }))
}

// ──────────────────────────────────────────────────────────
// Upload
// ──────────────────────────────────────────────────────────

/** Upload file audio ke folder TheaterSoundDeck */
export async function uploadTrack(
  file: File,
  onProgress?: (percent: number) => void
): Promise<DriveFileInfo> {
  const folderId = await ensureAppFolder()
  const accessToken = (gapi.client.getToken() as any).access_token

  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: [folderId],
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime')
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const f = JSON.parse(xhr.responseText)
        resolve({
          id: f.id,
          name: stripExtension(f.name),
          fileName: f.name,
          mimeType: f.mimeType,
          size: parseInt(f.size || '0'),
          modifiedTime: f.modifiedTime,
        })
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(form)
  })
}

// ──────────────────────────────────────────────────────────
// Download (untuk caching)
// ──────────────────────────────────────────────────────────

/** Download blob audio dari Drive (untuk cache ke IndexedDB) */
export async function downloadTrackBlob(fileId: string): Promise<Blob> {
  const accessToken = (gapi.client.getToken() as any).access_token

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  return response.blob()
}

// ──────────────────────────────────────────────────────────
// Rename
// ──────────────────────────────────────────────────────────

/** Rename file di Drive (simpan ekstensi asli) */
export async function renameTrack(fileId: string, newName: string, originalFileName: string): Promise<void> {
  const ext = originalFileName.split('.').pop() || ''
  const newFileName = ext ? `${newName}.${ext}` : newName

  await (gapi.client as any).drive.files.update({
    fileId,
    resource: { name: newFileName },
  } as any)
}

// ──────────────────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────────────────

/** Hapus file dari Drive (move to trash) */
export async function deleteTrack(fileId: string): Promise<void> {
  await (gapi.client as any).drive.files.delete({ fileId } as any)
}

// ──────────────────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────────────────

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}
