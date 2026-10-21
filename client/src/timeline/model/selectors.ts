import type { Track, TimelineState } from './types'

/** Empty space kept after the last line so it isn't flush with the right edge. */
export const END_PADDING_SECONDS = 2

export function trackEnd(track: Track): number {
  return track.start + track.duration
}

/** Header order: by line start, ties broken alphabetically by name (then id, so it's total). */
export function compareTracks(a: Track, b: Track): number {
  return a.start - b.start || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

export function getOrderedTracks(state: TimelineState): Track[] {
  return Object.values(state.tracks).sort(compareTracks)
}

/** End of the last line, in seconds (0 for an empty timeline). */
export function getContentEnd(state: TimelineState): number {
  let end = 0
  for (const track of Object.values(state.tracks)) end = Math.max(end, trackEnd(track))
  return end
}

/** Scrollable length of the timeline, in seconds. */
export function getTimelineDuration(state: TimelineState): number {
  return getContentEnd(state) + END_PADDING_SECONDS
}

/** Builds normalized state from a flat list; y is clamped to [0, 1]. */
export function createTimelineState(tracks: Track[]): TimelineState {
  const state: TimelineState = { tracks: {} }
  for (const t of tracks) {
    if (state.tracks[t.id]) throw new Error(`Duplicate track id ${t.id}`)
    state.tracks[t.id] = { ...t, y: Math.min(1, Math.max(0, t.y)) }
  }
  return state
}
