import { timeToX, xToTime, type Viewport } from './viewport'

/** Seconds between labelled (major) and unlabelled (minor) ticks. major/minor is an integer. */
export type TickScale = { major: number; minor: number }

const SCALES: TickScale[] = [
  { major: 0.1, minor: 0.02 },
  { major: 0.5, minor: 0.1 },
  { major: 1, minor: 0.2 },
  { major: 2, minor: 0.5 },
  { major: 5, minor: 1 },
  { major: 10, minor: 2 },
  { major: 15, minor: 5 },
  { major: 30, minor: 5 },
  { major: 60, minor: 10 },
  { major: 120, minor: 30 },
  { major: 300, minor: 60 },
]

/** Minimum px between labels so they never overlap. */
export const MIN_MAJOR_SPACING_PX = 70

/** Smallest "nice" interval whose labels are at least `minSpacingPx` apart. */
export function pickTickScale(pxPerSecond: number, minSpacingPx = MIN_MAJOR_SPACING_PX): TickScale {
  return SCALES.find((s) => s.major * pxPerSecond >= minSpacingPx) ?? SCALES[SCALES.length - 1]
}

export type Tick = { time: number; x: number; major: boolean }

/** Every minor tick in [0, viewWidth]; iterates by integer index to avoid float drift. */
export function visibleTicks(v: Viewport, viewWidth: number, scale: TickScale): Tick[] {
  const ratio = Math.round(scale.major / scale.minor)
  const first = Math.max(0, Math.floor(xToTime(0, v) / scale.minor))
  const last = Math.ceil(xToTime(viewWidth, v) / scale.minor)
  const ticks: Tick[] = []
  for (let i = first; i <= last; i++) {
    const time = i * scale.minor
    ticks.push({ time, x: timeToX(time, v), major: i % ratio === 0 })
  }
  return ticks
}

/** m:ss, with tenths when the interval is sub-second. */
export function formatTime(seconds: number, interval: number): string {
  const t = Math.round(seconds * 1000) / 1000
  const minutes = Math.floor(t / 60)
  const decimals = interval < 1 ? 1 : 0
  const secs = (t - minutes * 60).toFixed(decimals).padStart(decimals ? 4 : 2, '0')
  return `${minutes}:${secs}`
}
