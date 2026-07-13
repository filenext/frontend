export function normalizePath(p: string) {
  const s = (p || '/').trim()
  if (s === '' || s === '/') return '/'
  return s.startsWith('/') ? s.replace(/\/+$/, '') || '/' : `/${s}`.replace(/\/+$/, '') || '/'
}

export function joinPath(base: string, name: string) {
  const b = normalizePath(base)
  const n = name.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!n) return b
  return b === '/' ? `/${n}` : `${b}/${n}`
}

export function parentPath(path: string) {
  const p = normalizePath(path)
  if (p === '/') return '/'
  const i = p.lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}

/** 判断 target 是否在 root 挂载范围内（含 root 本身） */
export function pathWithin(root: string, target: string) {
  const r = normalizePath(root)
  const t = normalizePath(target)
  if (r === '/') return true
  return t === r || t.startsWith(`${r}/`)
}

export function storageShortcuts(
  rootPath: string,
  items: { name: string; path: string; isDir: boolean }[],
) {
  const dirs = items.filter((f) => f.isDir).slice(0, 6)
  return [{ label: '根目录', path: rootPath }, ...dirs.map((d) => ({ label: d.name, path: d.path }))]
}
