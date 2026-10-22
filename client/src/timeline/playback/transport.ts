import { timeToStep } from '../model/tempo'

/**
 * Transport state as pure data. The playhead position is stored in steps (16th notes), not
 * seconds, so it stays on the same musical position if the project BPM changes.
 *
 * While playing, the position is not stored per frame: it is derived from an anchor
 * (`anchorStep` at wall-clock `anchorTimeMs`) and the project BPM:
 *
 *   step(now) = anchorStep + timeToStep((now - anchorTimeMs) / 1000, bpm)
 *
 * so the playhead advances exactly `bpm * 4 / 60` steps per second, with no drift from frame timing.
 */
export type TransportState = {
  playing: boolean
  /** Playhead step at `anchorTimeMs` (the playhead itself when stopped). */
  anchorStep: number
  /** Wall-clock time (ms, e.g. performance.now()) the anchor was taken. */
  anchorTimeMs: number
}

export const INITIAL_TRANSPORT: TransportState = { playing: false, anchorStep: 0, anchorTimeMs: 0 }

export function positionAt(s: TransportState, nowMs: number, bpm: number): number {
  if (!s.playing) return s.anchorStep
  return s.anchorStep + timeToStep(Math.max(0, nowMs - s.anchorTimeMs) / 1000, bpm)
}

export function play(s: TransportState, nowMs: number): TransportState {
  return s.playing ? s : { playing: true, anchorStep: s.anchorStep, anchorTimeMs: nowMs }
}

/** Halts and keeps the playhead where it is. */
export function pause(s: TransportState, nowMs: number, bpm: number): TransportState {
  return s.playing ? { playing: false, anchorStep: positionAt(s, nowMs, bpm), anchorTimeMs: nowMs } : s
}

/** Halts and returns the playhead to the start of the timeline. */
export function stop(s: TransportState, nowMs: number): TransportState {
  return !s.playing && s.anchorStep === 0 ? s : { playing: false, anchorStep: 0, anchorTimeMs: nowMs }
}

/** Moves the playhead; keeps playing if it was. */
export function seek(s: TransportState, step: number, nowMs: number): TransportState {
  return { ...s, anchorStep: Math.max(0, step), anchorTimeMs: nowMs }
}

/**
 * Re-anchors at the current position. Call with the *old* BPM before the BPM changes, so the
 * playhead keeps its musical position and continues at the new speed from there.
 */
export function rebase(s: TransportState, nowMs: number, oldBpm: number): TransportState {
  return s.playing ? { ...s, anchorStep: positionAt(s, nowMs, oldBpm), anchorTimeMs: nowMs } : s
}
