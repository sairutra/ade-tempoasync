import { STEPS_PER_BEAT, stepToTime } from '../model/tempo'
import { formatStep } from '../viewport/ticks'

/** Playhead position as `bar.beat.16th` (1-indexed, floored to the current 16th). */
export function formatBarBeatStep(step: number): string {
  return formatStep(Math.floor(step + 1e-9), 1)
}

/** Playhead position as `m:ss.mmm` at the project BPM. */
export function formatClock(step: number, bpm: number): string {
  const ms = Math.floor(stepToTime(step, bpm) * 1000 + 1e-6)
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

/** Steps per second at a BPM: the playhead speed. */
export function stepsPerSecond(bpm: number): number {
  return (bpm * STEPS_PER_BEAT) / 60
}
