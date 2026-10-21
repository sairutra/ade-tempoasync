/**
 * Track colours: each line needs a colour that can be told apart from the others. A picked colour
 * that matches (or nearly matches) one already in use is nudged to a slightly different shade.
 */

type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

/**
 * Below this distance two colours count as "the same" (see colorDistance). An exact match is 0;
 * one shade step (SHADE_STEP) on a mid-tone colour is roughly 50–70, so adjusted shades clear it.
 */
export const MIN_COLOR_DISTANCE = 30

/** Lightness change per adjustment attempt, in HSL percentage points. */
export const SHADE_STEP = 10

/** Suggested colours for new tracks, tried in order. */
export const TRACK_PALETTE = [
  '#e07a5f', '#81b29a', '#3d85c6', '#c48bd6', '#f2cc8f',
  '#e5989b', '#6ec5c9', '#9a8c98', '#b5c99a', '#f4a261',
]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function parseHex(hex: string): Rgb | null {
  const m = HEX.exec(hex.trim())
  if (!m) return null
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const n = parseInt(digits, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** Lower-case #rrggbb, or null when not a hex colour. */
export function normalizeHex(hex: string): string | null {
  const rgb = parseHex(hex)
  return rgb ? toHex(rgb) : null
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
}

/** "Redmean" RGB distance: cheap, and closer to perceived difference than plain Euclidean. */
export function colorDistance(a: Rgb, b: Rgb): number {
  const rMean = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db)
}

function isDistinct(rgb: Rgb, used: readonly Rgb[]): boolean {
  return used.every((u) => colorDistance(rgb, u) >= MIN_COLOR_DISTANCE)
}

/**
 * Returns `picked` (normalized) when it differs from every colour in `used`. Otherwise returns the
 * nearest slightly different shade of it that does: lighter/darker in SHADE_STEP increments first,
 * then (for colours with no room left, e.g. near white/black) small hue shifts.
 * Invalid entries in `used` are ignored; an invalid `picked` throws.
 */
export function distinctColor(picked: string, used: readonly string[]): string {
  const rgb = parseHex(picked)
  if (!rgb) throw new Error(`Invalid colour ${picked}`)
  const usedRgb = used.map(parseHex).filter((c): c is Rgb => c !== null)
  if (isDistinct(rgb, usedRgb)) return toHex(rgb)

  const hsl = rgbToHsl(rgb)
  const candidates: Hsl[] = []
  for (let i = 1; i <= 9; i++) {
    // Prefer the direction with more room, so a light colour gets darker first and vice versa.
    const sign = hsl.l > 50 ? -1 : 1
    for (const dir of [sign, -sign]) {
      const l = hsl.l + dir * i * SHADE_STEP
      if (l >= 5 && l <= 95) candidates.push({ ...hsl, l })
    }
  }
  for (let i = 1; i <= 12; i++) {
    for (const dir of [1, -1]) candidates.push({ ...hsl, h: (hsl.h + dir * i * 15 + 360) % 360 })
  }
  for (const c of candidates) {
    const out = hslToRgb(c)
    // Round before checking, so the returned hex is the colour that was checked.
    const rounded = parseHex(toHex(out))!
    if (isDistinct(rounded, usedRgb)) return toHex(rounded)
  }
  // Every candidate clashes (dozens of near-identical colours): take the least crowded one.
  let best = rgb
  let bestDist = -1
  for (const c of candidates) {
    const out = parseHex(toHex(hslToRgb(c)))!
    const nearest = Math.min(...usedRgb.map((u) => colorDistance(out, u)))
    if (nearest > bestDist) [best, bestDist] = [out, nearest]
  }
  return toHex(best)
}

/** First palette colour not already in use (falls back to a distinct shade of the first). */
export function suggestColor(used: readonly string[]): string {
  const usedRgb = used.map(parseHex).filter((c): c is Rgb => c !== null)
  const free = TRACK_PALETTE.find((c) => isDistinct(parseHex(c)!, usedRgb))
  return free ?? distinctColor(TRACK_PALETTE[0], used)
}
