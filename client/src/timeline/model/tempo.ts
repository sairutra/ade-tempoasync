/**
 * Musical time. Fixed 4/4: 1 bar = 4 beats = 16 steps, 1 step = one 16th note.
 * All step <-> seconds conversion goes through stepToTime / timeToStep; nothing else
 * should hard-code the `60 / bpm / 4` relationship.
 */

export const STEPS_PER_BEAT = 4
export const BEATS_PER_BAR = 4
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR

export const DEFAULT_BPM = 120

/** Seconds at `step` (may be fractional). */
export function stepToTime(step: number, bpm: number): number {
  return (step * 60) / bpm / STEPS_PER_BEAT
}

/** Inverse of stepToTime: (possibly fractional) step at `seconds`. */
export function timeToStep(seconds: number, bpm: number): number {
  return (seconds * bpm * STEPS_PER_BEAT) / 60
}
