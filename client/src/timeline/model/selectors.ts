import { deriveNodes, isValidNodes } from './nodes'
import { DEFAULT_BPM, stepToTime } from './tempo'
import type { Track, TrackInput, TimelineState } from './types'

/** Empty space kept after the furthest point so it isn't flush with the right edge. */
export const END_PADDING_SECONDS = 2

export const DEFAULT_BPM_MIN = 60
export const DEFAULT_BPM_MAX = 200

/** Step of the track's last point. */
export function trackLastStep(track: Pick<Track, 'startStep' | 'bpms'>): number {
  return track.startStep + track.bpms.length - 1
}

/** Header order: by start step, ties broken alphabetically by name (then id, so it's total). */
export function compareTracks(a: Track, b: Track): number {
  return a.startStep - b.startStep || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

export function getOrderedTracks(state: TimelineState): Track[] {
  return Object.values(state.tracks).sort(compareTracks)
}

/** Step of the furthest last point over all tracks (0 for an empty timeline). */
export function getContentEndStep(state: TimelineState): number {
  let end = 0
  for (const track of Object.values(state.tracks)) end = Math.max(end, trackLastStep(track))
  return end
}

/** Scrollable length of the timeline, in seconds: furthest last point plus padding. */
export function getTimelineDuration(state: TimelineState): number {
  return stepToTime(getContentEndStep(state), state.projectBpm) + END_PADDING_SECONDS
}

/** Clamps a BPM into the drawable range. Only the renderer clamps; the model keeps raw values. */
export function clampBpm(bpm: number, bpmMin: number, bpmMax: number): number {
  return Math.min(bpmMax, Math.max(bpmMin, bpm))
}

/** Vertical position as a 0–1 fraction of the lane area (0 = top = bpmMax), clamped. */
export function bpmToFraction(bpm: number, bpmMin: number, bpmMax: number): number {
  return (bpmMax - clampBpm(bpm, bpmMin, bpmMax)) / (bpmMax - bpmMin)
}

export type TimelineOptions = { projectBpm?: number; bpmMin?: number; bpmMax?: number }

/**
 * Builds normalized, validated state from a flat list. BPM values are not clamped here.
 * Tracks without `nodes` get them derived from their points (see deriveNodes).
 */
export function createTimelineState(tracks: TrackInput[], options: TimelineOptions = {}): TimelineState {
  const { projectBpm = DEFAULT_BPM, bpmMin = DEFAULT_BPM_MIN, bpmMax = DEFAULT_BPM_MAX } = options
  if (!(projectBpm > 0) || !Number.isFinite(projectBpm)) throw new Error(`Invalid BPM ${projectBpm}`)
  if (!Number.isFinite(bpmMin) || !Number.isFinite(bpmMax) || !(bpmMin < bpmMax)) {
    throw new Error(`Invalid BPM range [${bpmMin}, ${bpmMax}]`)
  }
  const state: TimelineState = { tracks: {}, projectBpm, bpmMin, bpmMax }
  for (const t of tracks) {
    if (state.tracks[t.id]) throw new Error(`Duplicate track id ${t.id}`)
    if (!Number.isInteger(t.startStep) || t.startStep < 0) throw new Error(`Invalid startStep on ${t.id}`)
    if (t.bpms.length === 0) throw new Error(`Track ${t.id} has no points`)
    if (!t.bpms.every(Number.isFinite)) throw new Error(`Non-finite BPM on ${t.id}`)
    const nodes = t.nodes ?? deriveNodes(t.bpms)
    if (!isValidNodes(nodes, t.bpms.length)) throw new Error(`Invalid nodes on ${t.id}`)
    state.tracks[t.id] = { ...t, nodes }
  }
  return state
}
