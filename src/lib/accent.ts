export const DEFAULT_ACCENT = '#1DB954'

/** Presets tuned for Green Deck (dark UI): greens + complementary accents */
export const ACCENT_PRESETS = [
  { id: 'spotify', label: 'Verde Deck', value: '#1DB954' },
  { id: 'lima', label: 'Lima', value: '#84CC16' },
  { id: 'menta', label: 'Menta', value: '#2DD4BF' },
  { id: 'rosa', label: 'Rosa', value: '#FF4D9E' },
  { id: 'coral', label: 'Coral', value: '#FF6B6B' },
  { id: 'naranja', label: 'Naranja', value: '#F97316' },
  { id: 'ambar', label: 'Ámbar', value: '#F59E0B' },
  { id: 'azul', label: 'Azul', value: '#3B82F6' },
  { id: 'cyan', label: 'Cyan', value: '#22D3EE' },
  { id: 'violeta', label: 'Violeta', value: '#A855F7' },
] as const

export type AccentPresetId = (typeof ACCENT_PRESETS)[number]['id']

const HEX_RE = /^#([0-9A-Fa-f]{6})$/
const DARK_UI_BG = '#121212'

export function isValidAccentHex(value: string): boolean {
  return HEX_RE.test(value)
}

export function normalizeAccent(value: string | null | undefined): string {
  if (!value) return DEFAULT_ACCENT
  const trimmed = value.trim()
  if (!isValidAccentHex(trimmed)) return DEFAULT_ACCENT
  return trimmed.toUpperCase()
}

export function applyAccentToDocument(accent: string): void {
  applyAccentWithHover(accent)
}

export function readStoredAccent(): string {
  return normalizeAccent(localStorage.getItem('ctf-accent'))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = normalizeAccent(hex).slice(1)
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

/** Relative luminance (sRGB), 0–1 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Prefer white or near-black label text on accent buttons */
export function preferredTextOnAccent(accent: string): '#FFFFFF' | '#121212' {
  const white = contrastRatio('#FFFFFF', accent)
  const dark = contrastRatio('#121212', accent)
  return white >= dark ? '#FFFFFF' : '#121212'
}

/**
 * True when accent is hard to see on Green Deck dark bg, or white/dark
 * label text on the accent fails a basic UI contrast check (~3:1).
 */
export function isAccentContrastRisky(accent: string): boolean {
  if (!isValidAccentHex(accent)) return true
  const onBg = contrastRatio(accent, DARK_UI_BG)
  const textOnAccent = Math.max(
    contrastRatio('#FFFFFF', accent),
    contrastRatio('#121212', accent),
  )
  return onBg < 2.2 || textOnAccent < 3
}

/** Brighten accent for hover (Green Deck: #1DB954 → #1ED760) */
export function deriveAccentHover(hex: string): string {
  const normalized = normalizeAccent(hex)
  if (normalized === '#1DB954') return '#1ED760'

  const raw = normalized.slice(1)
  const r = Math.min(255, parseInt(raw.slice(0, 2), 16) + 20)
  const g = Math.min(255, parseInt(raw.slice(2, 4), 16) + 20)
  const b = Math.min(255, parseInt(raw.slice(4, 6), 16) + 14)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

export function applyAccentWithHover(accent: string): void {
  const value = normalizeAccent(accent)
  const root = document.documentElement
  root.style.setProperty('--accent', value)
  root.style.setProperty('--accent-hover', deriveAccentHover(value))
  root.style.setProperty('--accent-border', value)
  root.style.setProperty('--text-on-accent', preferredTextOnAccent(value))
  root.style.setProperty(
    '--accent-glow',
    `color-mix(in srgb, ${value} 28%, transparent)`,
  )
  root.style.setProperty(
    '--accent-soft',
    `color-mix(in srgb, ${value} 16%, transparent)`,
  )
  root.style.setProperty(
    '--accent-softer',
    `color-mix(in srgb, ${value} 10%, transparent)`,
  )
  localStorage.setItem('ctf-accent', value)
}
