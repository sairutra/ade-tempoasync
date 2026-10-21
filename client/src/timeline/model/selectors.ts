import type { Clip, Track, TimelineState } from './types'

/** Empty space kept after the last clip so it isn't flush with the right edge. */
export const END_PADDING_SECONDS = 2

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration
}

export function getOrderedTracks(state: TimelineState): Track[] {
  return state.trackOrder.map((id) => state.tracks[id])
}

export function getTrackClips(state: TimelineState, trackId: string): Clip[] {
  return state.tracks[trackId].clipIds.map((id) => state.clips[id])
}

/** End of the last clip, in seconds (0 for an empty timeline). */
export function getContentEnd(state: TimelineState): number {
  let end = 0
  for (const clip of Object.values(state.clips)) end = Math.max(end, clipEnd(clip))
  return end
}

/** Scrollable length of the timeline, in seconds. */
export function getTimelineDuration(state: TimelineState): number {
  return getContentEnd(state) + END_PADDING_SECONDS
}

/** Builds normalized state from flat lists; clipIds are derived from each clip's trackId. */
export function createTimelineState(
  tracks: Omit<Track, 'clipIds'>[],
  clips: Clip[],
): TimelineState {
  const state: TimelineState = { tracks: {}, trackOrder: [], clips: {} }
  for (const t of tracks) {
    state.tracks[t.id] = { ...t, clipIds: [] }
    state.trackOrder.push(t.id)
  }
  for (const c of [...clips].sort((a, b) => a.start - b.start)) {
    const track = state.tracks[c.trackId]
    if (!track) throw new Error(`Clip ${c.id} references unknown track ${c.trackId}`)
    state.clips[c.id] = c
    track.clipIds.push(c.id)
  }
  return state
}
