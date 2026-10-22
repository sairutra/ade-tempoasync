import { onsetAt, stepAtOnset, stepOnsets, STEPS_PER_BAR, STEPS_PER_BEAT, stepToTime } from './tempo'

/**
 * Sync view: lines drawn at the real times their steps sound (see stepOnsets), so they can be
 * compared with the project grid and with each other. Rendering only; the model stays in steps.
 */

/** A line downbeat this close (seconds) to a project bar line counts as in sync. */
export const SYNC_TOLERANCE_SECONDS = 0.012

/** Onsets of a line's points, plus the BPM it holds after its last point. Memoise per `bpms`. */
export type LineTiming = { onsets: readonly number[]; lastBpm: number }

export function lineTiming(bpms: readonly number[]): LineTiming {
  return { onsets: stepOnsets(bpms, bpms.length - 1), lastBpm: bpms[bpms.length - 1] }
}

/** Seconds at which the line's (fractional) `step` sounds. */
export function lineTimeAt(timing: LineTiming, step: number): number {
  return onsetAt(timing.onsets, timing.lastBpm, step)
}

/** The line's (fractional) step sounding at `seconds`. */
export function lineStepAt(timing: LineTiming, seconds: number): number {
  return stepAtOnset(timing.onsets, timing.lastBpm, seconds)
}

/** True when `seconds` is within `tolerance` of a bar line of the project grid. */
export function isOnProjectBar(seconds: number, projectBpm: number, tolerance = SYNC_TOLERANCE_SECONDS): boolean {
  const bar = stepToTime(STEPS_PER_BAR, projectBpm)
  return Math.abs(seconds - Math.round(seconds / bar) * bar) <= tolerance
}

export type LineBeat = { step: number; time: number; level: 'bar' | 'beat'; inSync: boolean }

/**
 * The line's beats (every 4th step) from step 0 up to `endTime` seconds; downbeats (every 16th
 * step) are `bar` and flagged `inSync` when they land on a project bar line.
 * `beats: false` returns downbeats only.
 */
export function lineBeats(timing: LineTiming, endTime: number, projectBpm: number, beats = true): LineBeat[] {
  const interval = beats ? STEPS_PER_BEAT : STEPS_PER_BAR
  const out: LineBeat[] = []
  for (let step = 0; ; step += interval) {
    const time = lineTimeAt(timing, step)
    if (time > endTime) break
    const bar = step % STEPS_PER_BAR === 0
    out.push({ step, time, level: bar ? 'bar' : 'beat', inSync: bar && isOnProjectBar(time, projectBpm) })
  }
  return out
}
