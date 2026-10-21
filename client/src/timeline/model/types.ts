/**
 * All times are in seconds; vertical position is a 0–1 fraction of the lane area.
 * Pixels never appear in the model.
 *
 * A track is a single line: it starts at `start`, runs for `duration`, and sits at `y`.
 */
export type Track = {
  id: string
  name: string
  /** Timeline position of the line's left edge. */
  start: number
  duration: number
  /** Offset into the source audio where playback starts. */
  sourceOffset: number
  /** Vertical position inside the lane area: 0 = top, 1 = bottom. */
  y: number
  color?: string
}

/** Tracks by id. Display order is derived (see getOrderedTracks), not stored. */
export type TimelineState = {
  tracks: Record<string, Track>
  /** Project tempo in beats per minute; the ruler and grid derive bars/beats/16ths from it. */
  projectBpm: number
}
