/**
 * The BPM <-> pixel transform for the lane area's y-axis. Pure functions only, no React.
 * The vertical counterpart of viewport.ts: y is measured in CSS pixels from the top of the
 * visible lane area, higher BPM is drawn higher.
 *
 * The scrollable content is the whole BPM range [bpmMin, bpmMax] plus fixed padding above and
 * below (room for line labels and handles at the extremes):
 *
 *   contentY(bpm) = PAD_TOP + (bpmMax - bpm) * pxPerBpm
 *   y(bpm)        = contentY(bpm) - scrollY
 *
 * Zoom is stored as a multiple of the fit zoom (`zoom >= 1`), not as px per BPM, so a resize or a
 * new BPM range keeps the same relative stretch: zoom 1 always shows the whole range.
 */
export type BpmViewport = { zoom: number; scrollY: number }

/** Visible lane height (px) and the BPM range the content spans. */
export type BpmBounds = { viewHeight: number; bpmMin: number; bpmMax: number }

/** Content padding above bpmMax and below bpmMin, in px (fits a line label above a point). */
export const PAD_TOP = 22
export const PAD_BOTTOM = 10

export const MIN_ZOOM_Y = 1
export const MAX_ZOOM_Y = 40

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Height available to the BPM range when the whole range fits (zoom 1). */
function fitHeight(b: BpmBounds): number {
  return Math.max(1, b.viewHeight - PAD_TOP - PAD_BOTTOM)
}

export function pxPerBpm(v: BpmViewport, b: BpmBounds): number {
  return (fitHeight(b) / (b.bpmMax - b.bpmMin)) * v.zoom
}

/** Height of the BPM range itself (what the lines layer spans), in px. */
export function rangeHeight(v: BpmViewport, b: BpmBounds): number {
  return (b.bpmMax - b.bpmMin) * pxPerBpm(v, b)
}

/** Full scrollable height including padding, in px. */
export function contentHeight(v: BpmViewport, b: BpmBounds): number {
  return PAD_TOP + rangeHeight(v, b) + PAD_BOTTOM
}

export function maxScrollY(v: BpmViewport, b: BpmBounds): number {
  return Math.max(0, contentHeight(v, b) - b.viewHeight)
}

export function bpmToY(bpm: number, v: BpmViewport, b: BpmBounds): number {
  return PAD_TOP + (b.bpmMax - bpm) * pxPerBpm(v, b) - v.scrollY
}

export function yToBpm(y: number, v: BpmViewport, b: BpmBounds): number {
  return b.bpmMax - (y + v.scrollY - PAD_TOP) / pxPerBpm(v, b)
}

/** Clamps zoom and scroll. Returns the same object when nothing changed, so React can bail out. */
export function clampBpmViewport(v: BpmViewport, b: BpmBounds): BpmViewport {
  const zoom = clamp(v.zoom, MIN_ZOOM_Y, MAX_ZOOM_Y)
  const scrollY = clamp(v.scrollY, 0, maxScrollY({ zoom, scrollY: 0 }, b))
  return zoom === v.zoom && scrollY === v.scrollY ? v : { zoom, scrollY }
}

function keepIfEqual(prev: BpmViewport, next: BpmViewport): BpmViewport {
  return prev.zoom === next.zoom && prev.scrollY === next.scrollY ? prev : next
}

export function scrollYTo(v: BpmViewport, scrollY: number, b: BpmBounds): BpmViewport {
  return keepIfEqual(v, clampBpmViewport({ ...v, scrollY }, b))
}

export function scrollYBy(v: BpmViewport, dy: number, b: BpmBounds): BpmViewport {
  return scrollYTo(v, v.scrollY + dy, b)
}

/**
 * Zooms by `factor` keeping the BPM under `anchorY` fixed on screen:
 * solve bpmToY(anchorBpm, v') === anchorY for scrollY.
 */
export function zoomYAt(v: BpmViewport, factor: number, anchorY: number, b: BpmBounds): BpmViewport {
  const anchorBpm = yToBpm(anchorY, v, b)
  const zoom = clamp(v.zoom * factor, MIN_ZOOM_Y, MAX_ZOOM_Y)
  const next = { zoom, scrollY: 0 }
  const scrollY = PAD_TOP + (b.bpmMax - anchorBpm) * pxPerBpm(next, b) - anchorY
  return keepIfEqual(v, clampBpmViewport({ zoom, scrollY }, b))
}

/** Shows the whole BPM range. */
export function zoomYToFit(): BpmViewport {
  return { zoom: 1, scrollY: 0 }
}

/**
 * Re-targets the viewport at new bounds (resize or new BPM range), keeping the zoom and the BPM
 * at the centre of the view where possible.
 */
export function rebound(v: BpmViewport, prev: BpmBounds, next: BpmBounds): BpmViewport {
  if (prev.viewHeight <= 0) return clampBpmViewport(v, next)
  const centerBpm = clamp(yToBpm(prev.viewHeight / 2, v, prev), next.bpmMin, next.bpmMax)
  const scrollY = PAD_TOP + (next.bpmMax - centerBpm) * pxPerBpm(v, next) - next.viewHeight / 2
  return keepIfEqual(v, clampBpmViewport({ ...v, scrollY }, next))
}

/** [low, high] BPM visible, widened by `overscanPx` on each side. */
export function visibleBpmRange(v: BpmViewport, b: BpmBounds, overscanPx = 0): [number, number] {
  return [yToBpm(b.viewHeight + overscanPx, v, b), yToBpm(-overscanPx, v, b)]
}

export type BpmTick = { bpm: number; y: number; major: boolean }

/** Labelled ticks need at least this much vertical room. */
export const BPM_TICK_MIN_SPACING_PX = 22

const NICE = [1, 2, 5]

/** Smallest "nice" BPM interval (1, 2, 5, 10, 20, 50, …) whose ticks are at least `minPx` apart. */
export function pickBpmInterval(pxPerBpmValue: number, minPx = BPM_TICK_MIN_SPACING_PX): number {
  for (let mag = 1; mag < 1e6; mag *= 10) {
    for (const n of NICE) if (n * mag * pxPerBpmValue >= minPx) return n * mag
  }
  return 1e6
}

/**
 * Ticks at multiples of the picked interval inside the BPM range and the visible window.
 * Ticks on the next power of ten are major, mirroring bar/beat weight on the ruler.
 * The range ends are always included so the axis shows the min and max.
 */
export function visibleBpmTicks(v: BpmViewport, b: BpmBounds, minPx = BPM_TICK_MIN_SPACING_PX): BpmTick[] {
  const ppb = pxPerBpm(v, b)
  const interval = pickBpmInterval(ppb, minPx)
  // Interval 1, 2 or 5 → major every 10; 10, 20 or 50 → every 100; …
  const majorEvery = 10 ** (Math.floor(Math.log10(interval)) + 1)
  const [lo, hi] = visibleBpmRange(v, b, minPx)
  const from = Math.max(b.bpmMin, lo)
  const to = Math.min(b.bpmMax, hi)
  const ticks: BpmTick[] = []
  for (let bpm = Math.ceil(from / interval) * interval; bpm <= to + 1e-9; bpm += interval) {
    ticks.push({ bpm, y: bpmToY(bpm, v, b), major: isMultiple(bpm, majorEvery) })
  }
  // Range ends: always shown, unless a regular tick would collide with them.
  for (const end of [b.bpmMin, b.bpmMax]) {
    if (end < lo || end > hi) continue
    const y = bpmToY(end, v, b)
    const near = ticks.findIndex((t) => Math.abs(t.y - y) < minPx)
    if (near >= 0 && ticks[near].bpm === end) {
      ticks[near] = { ...ticks[near], major: true }
      continue
    }
    if (near >= 0) ticks.splice(near, 1)
    ticks.push({ bpm: end, y, major: true })
  }
  return ticks.sort((a, c) => c.bpm - a.bpm)
}

function isMultiple(n: number, of: number): boolean {
  return Math.abs(n / of - Math.round(n / of)) < 1e-9
}
