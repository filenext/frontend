export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim()
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return [r, g, b]
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return [r, g, b]
  }
  return null
}

export function applyTheme(color: string) {
  const rgb = hexToRgb(color)
  const root = document.documentElement
  root.style.setProperty('--tblr-primary', color)
  root.style.setProperty('--cd-primary', color)
  if (rgb) {
    const [r, g, b] = rgb
    root.style.setProperty('--tblr-primary-rgb', `${r}, ${g}, ${b}`)
    root.style.setProperty('--cd-primary-rgb', `${r}, ${g}, ${b}`)
    root.style.setProperty('--cd-primary-soft', `rgba(${r}, ${g}, ${b}, 0.08)`)
    root.style.setProperty('--cd-primary-glow', `rgba(${r}, ${g}, ${b}, 0.25)`)
  }
}

export function applyFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url || '/favicon.svg'
}

export function applyDocumentTitle(name: string) {
  document.title = name
}
