const STORAGE_KEY = 'nf-upload-sessions'

type SessionMap = Record<string, string>

function readMap(): SessionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SessionMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: SessionMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function fileFingerprint(
  storageId: string,
  targetKey: string,
  file: File,
): string {
  return [storageId, targetKey, file.name, String(file.size), String(file.lastModified)].join('|')
}

export function getStoredUploadId(fingerprint: string): string | undefined {
  return readMap()[fingerprint]
}

export function setStoredUploadId(fingerprint: string, uploadId: string) {
  const map = readMap()
  map[fingerprint] = uploadId
  writeMap(map)
}

export function clearStoredUploadId(fingerprint: string) {
  const map = readMap()
  if (!(fingerprint in map)) return
  delete map[fingerprint]
  writeMap(map)
}
