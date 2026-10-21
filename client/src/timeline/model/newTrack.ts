import { distinctColor } from './colors'
import { roundBpm } from './nodes'
import { getContentEndStep } from './selectors'
import { STEPS_PER_BAR } from './tempo'
import type { TimelineState, Track } from './types'

/** A new line spans at least this many steps, so it has room to be shaped even on an empty timeline. */
export const NEW_TRACK_MIN_STEPS = 4 * STEPS_PER_BAR

export type NewTrackInput = {
  name: string
  /** Picked colour; adjusted to a distinct shade if another track already uses it. */
  color: string
  /** Initial (flat) BPM of the line. */
  bpm: number
}

/** Colours already in use by tracks of `state`. */
export function usedColors(state: TimelineState): string[] {
  return Object.values(state.tracks).flatMap((t) => (t.color ? [t.color] : []))
}

function uniqueId(state: TimelineState, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track'
  if (!state.tracks[slug]) return slug
  let n = 2
  while (state.tracks[`${slug}-${n}`]) n++
  return `${slug}-${n}`
}

/**
 * Builds a flat line at `bpm` from step 0 to the current content end (at least
 * NEW_TRACK_MIN_STEPS long), with nodes at both ends so it can be bent right away.
 * Throws on input createTimelineState would reject, so callers validate first.
 */
export function buildNewTrack(state: TimelineState, input: NewTrackInput): Track {
  const name = input.name.trim()
  if (!name) throw new Error('Track name is required')
  if (!(input.bpm > 0) || !Number.isFinite(input.bpm)) throw new Error(`Invalid BPM ${input.bpm}`)

  const length = Math.max(NEW_TRACK_MIN_STEPS, getContentEndStep(state) + 1)
  const bpm = roundBpm(input.bpm)
  return {
    id: uniqueId(state, name),
    name,
    bpms: Array.from({ length }, () => bpm),
    nodes: [0, length - 1],
    sourceOffset: 0,
    color: distinctColor(input.color, usedColors(state)),
  }
}
