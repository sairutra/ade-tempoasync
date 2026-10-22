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

/**
 * Real onset time (seconds) of each step of a line played one 16th at a time at its own BPMs —
 * what the backend's SequencePlayer does: step i sounds at the sum of stepToTime(1, bpms[k]) over
 * k < i. After the last point the line holds its last BPM, so onsets continue at that rate.
 * Returns onsets for steps 0..max(bpms.length - 1, ceil(endStep)).
 */
export function stepOnsets(bpms: readonly number[], endStep: number): number[] {
  const count = Math.max(bpms.length, Math.ceil(endStep) + 1)
  const onsets = new Array<number>(count)
  onsets[0] = 0
  const last = bpms[bpms.length - 1]
  for (let i = 1; i < count; i++) {
    onsets[i] = onsets[i - 1] + stepToTime(1, i - 1 < bpms.length ? bpms[i - 1] : last)
  }
  return onsets
}

/**
 * Onset time of a (possibly fractional) `step`, from `onsets` (see stepOnsets): linear between
 * neighbouring steps, and past the last onset extrapolated at `lastBpm` (the held BPM).
 */
export function onsetAt(onsets: readonly number[], lastBpm: number, step: number): number {
  if (step <= 0) return step * (onsets.length > 1 ? onsets[1] : stepToTime(1, lastBpm))
  const end = onsets.length - 1
  if (step >= end) return onsets[end] + stepToTime(step - end, lastBpm)
  const i = Math.floor(step)
  return onsets[i] + (onsets[i + 1] - onsets[i]) * (step - i)
}

/** Inverse of onsetAt: the (fractional) step sounding at `seconds`, by binary search over `onsets`. */
export function stepAtOnset(onsets: readonly number[], lastBpm: number, seconds: number): number {
  const end = onsets.length - 1
  if (seconds >= onsets[end]) return end + timeToStep(seconds - onsets[end], lastBpm)
  if (seconds <= 0) return onsets.length > 1 ? seconds / onsets[1] : timeToStep(seconds, lastBpm)
  let lo = 0
  let hi = end // invariant: onsets[lo] <= seconds < onsets[hi]
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (onsets[mid] <= seconds) lo = mid
    else hi = mid
  }
  return lo + (seconds - onsets[lo]) / (onsets[hi] - onsets[lo])
}
