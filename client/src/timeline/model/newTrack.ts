import { distinctColor } from './colors'
import { deriveNodes, roundBpm } from './nodes'
import { generatePattern, patternError, patternLength, quantizeInSync, type PatternSpec } from './patterns'
import { isValidSequence } from './sequence'
import { getContentEndStep } from './selectors'
import { STEPS_PER_BAR } from './tempo'
import type { TimelineState, Track } from './types'

/** A new line spans at least this many steps, so it has room to be shaped even on an empty timeline. */
export const NEW_TRACK_MIN_BARS = 32
export const NEW_TRACK_MIN_STEPS = NEW_TRACK_MIN_BARS * STEPS_PER_BAR

/** Channel numbers are integers in this range. */
export const CHANNEL_MIN = 1
export const CHANNEL_MAX = 16

export function isValidChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= CHANNEL_MIN && channel <= CHANNEL_MAX
}

/** Lowest channel no track uses yet, or CHANNEL_MIN when all are taken. */
export function suggestChannel(state: TimelineState): number {
  const used = new Set(Object.values(state.tracks).map((t) => t.channel))
  for (let c = CHANNEL_MIN; c <= CHANNEL_MAX; c++) if (!used.has(c)) return c
  return CHANNEL_MIN
}

export type NewTrackInput = {
  name: string
  /** Picked colour; adjusted to a distinct shade if another track already uses it. */
  color: string
  /** BPM of a flat line; with `pattern`, the sync BPM the pattern keeps time with. */
  bpm: number
  /** Generate the line from this pattern instead of a flat line at `bpm` (see patterns.ts). */
  pattern?: PatternSpec
  /** Channel number, an integer in [CHANNEL_MIN, CHANNEL_MAX]. */
  channel: number
  /** MIDI sequence, 1–16 steps of MIDI notes (0–127) or -1 for a rest (see sequence.ts). */
  sequence: number[]
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
 * Builds a line from step 0 to the current content end (at least NEW_TRACK_MIN_STEPS long): flat at
 * `bpm` with nodes at both ends, or, with `pattern`, the generated pattern rounded up to whole sync
 * windows, with a node at every bend.
 * Throws on input createTimelineState would reject, so callers validate first.
 */
export function buildNewTrack(state: TimelineState, input: NewTrackInput): Track {
  const name = input.name.trim()
  if (!name) throw new Error('Track name is required')
  if (!(input.bpm > 0) || !Number.isFinite(input.bpm)) throw new Error(`Invalid BPM ${input.bpm}`)
  if (!isValidChannel(input.channel)) throw new Error(`Invalid channel ${input.channel}`)
  if (!isValidSequence(input.sequence)) throw new Error(`Invalid sequence ${JSON.stringify(input.sequence)}`)
  const patternProblem = input.pattern && patternError(input.pattern, input.bpm)
  if (patternProblem) throw new Error(`Invalid pattern: ${patternProblem}`)

  const minLength = Math.max(NEW_TRACK_MIN_STEPS, getContentEndStep(state) + 1)
  let bpms: number[]
  let nodes: number[]
  if (input.pattern) {
    const length = patternLength(input.pattern, minLength)
    bpms = quantizeInSync(generatePattern(input.pattern, input.bpm, length))
    nodes = deriveNodes(bpms)
  } else {
    const bpm = roundBpm(input.bpm)
    bpms = Array.from({ length: minLength }, () => bpm)
    nodes = [0, minLength - 1]
  }
  return {
    id: uniqueId(state, name),
    name,
    bpms,
    nodes,
    sourceOffset: 0,
    color: distinctColor(input.color, usedColors(state)),
    channel: input.channel,
    sequence: input.sequence.slice(),
  }
}
