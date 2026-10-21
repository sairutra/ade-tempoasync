import { STEPS_PER_BAR, STEPS_PER_BEAT, stepToTime, timeToStep } from '../model/tempo'
import { timeToX, xToTime, type Viewport } from './viewport'

/**
 * Tick intervals in steps (16th notes). `minor` is the next finer candidate below `major`,
 * or null when there is none or it would be drawn too densely.
 */
export type TickScale = { major: number; minor: number | null }

/** Minimum px between labels so they never overlap. */
export const MIN_MAJOR_SPACING_PX = 60

/** Ruler and grid draw minor ticks only when they are at least this far apart (CSS px). */
export const RULER_MIN_MINOR_SPACING_PX = 5
export const GRID_MIN_MINOR_SPACING_PX = 12

/** Hard stop for degenerate zoom/BPM; 2^40 bars is far beyond any real timeline. */
const MAX_CANDIDATE_INDEX = 42

/** Candidate intervals in steps, finest to coarsest: 16th, beat, bar, then 2, 4, 8… bars. */
export function tickCandidate(index: number): number {
  if (index === 0) return 1
  if (index === 1) return STEPS_PER_BEAT
  return STEPS_PER_BAR * 2 ** (index - 2)
}

/** Pixels per 16th note at a zoom level and tempo. */
export function pxPerStep(pxPerSecond: number, bpm: number): number {
  return pxPerSecond * stepToTime(1, bpm)
}

/**
 * Major: the smallest candidate whose spacing fits a label.
 * Minor: the next finer candidate, if it is at least `minMinorSpacingPx` apart.
 */
export function pickTickScale(
  pxPerStepValue: number,
  minMinorSpacingPx: number,
  minMajorSpacingPx = MIN_MAJOR_SPACING_PX,
): TickScale {
  let index = 0
  if (pxPerStepValue > 0) {
    while (index < MAX_CANDIDATE_INDEX && tickCandidate(index) * pxPerStepValue < minMajorSpacingPx) index++
  } else {
    index = 2 // nothing sensible to fit; fall back to bars
  }
  const major = tickCandidate(index)
  const finer = index > 0 ? tickCandidate(index - 1) : null
  const minor = finer !== null && finer * pxPerStepValue >= minMinorSpacingPx ? finer : null
  return { major, minor }
}

export type TickLevel = 'bar' | 'beat' | 'step'

/** Musical weight of a step position, independent of zoom: drives tick height and color. */
export function tickLevel(step: number): TickLevel {
  if (step % STEPS_PER_BAR === 0) return 'bar'
  if (step % STEPS_PER_BEAT === 0) return 'beat'
  return 'step'
}

export type Tick = { step: number; time: number; x: number; major: boolean; level: TickLevel }

/** Every tick in [0, viewWidth]; steps are integers, so there is no float drift. */
export function visibleTicks(v: Viewport, viewWidth: number, scale: TickScale, bpm: number): Tick[] {
  const interval = scale.minor ?? scale.major
  const first = Math.max(0, Math.floor(timeToStep(xToTime(0, v), bpm) / interval))
  const last = Math.ceil(timeToStep(xToTime(viewWidth, v), bpm) / interval)
  const ticks: Tick[] = []
  for (let i = first; i <= last; i++) {
    const step = i * interval
    const time = stepToTime(step, bpm)
    ticks.push({ step, time, x: timeToX(time, v), major: step % scale.major === 0, level: tickLevel(step) })
  }
  return ticks
}

/**
 * 1-indexed label whose precision follows the major unit:
 * bars → `5`, beats → `5.2`, 16ths → `5.2.3`.
 */
export function formatStep(step: number, majorInterval: number): string {
  const bar = Math.floor(step / STEPS_PER_BAR) + 1
  if (majorInterval >= STEPS_PER_BAR) return `${bar}`
  const beat = Math.floor((step % STEPS_PER_BAR) / STEPS_PER_BEAT) + 1
  if (majorInterval >= STEPS_PER_BEAT) return `${bar}.${beat}`
  const sixteenth = (step % STEPS_PER_BEAT) + 1
  return `${bar}.${beat}.${sixteenth}`
}
