export interface UploadEntry {
  file: File
  relativePath?: string
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const read = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all)
            return
          }
          all.push(...batch)
          read()
        },
        reject,
      )
    }
    read()
  })
}

async function walkEntry(entry: FileSystemEntry, base: string, out: UploadEntry[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    const rel = base ? `${base}/${file.name}` : file.name
    out.push({ file, relativePath: rel })
    return
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children = await readAllEntries(reader)
    const nextBase = base ? `${base}/${entry.name}` : entry.name
    await Promise.all(children.map((child) => walkEntry(child, nextBase, out)))
  }
}

/** 从拖拽 DataTransfer 收集文件（含文件夹结构） */
export async function collectDropEntries(dt: DataTransfer): Promise<UploadEntry[]> {
  const items = dt.items
  if (!items?.length) {
    return Array.from(dt.files || []).map((file) => ({ file }))
  }
  const entries: UploadEntry[] = []
  const tasks: Promise<void>[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) {
      tasks.push(walkEntry(entry, '', entries))
      continue
    }
    const file = item.getAsFile()
    if (file) entries.push({ file })
  }
  await Promise.all(tasks)
  if (entries.length) return entries
  return Array.from(dt.files || []).map((file) => ({ file }))
}

/** 从 input[webkitdirectory] 收集文件 */
export function collectDirectoryInput(files: FileList | File[]): UploadEntry[] {
  return Array.from(files).map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    return { file, relativePath: rel || file.name }
  })
}
