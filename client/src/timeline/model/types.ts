/**
 * Horizontal positions are integer steps (1 step = one 16th note at `projectBpm`, see tempo.ts);
 * vertical positions are BPM. Pixels never appear in the model.
 *
 * A track is a BPM curve with exactly one point per step and no gaps: point i sits at step
 * `startStep + i` with BPM `bpms[i]`. Storing a start plus a dense array (rather than x per point)
 * makes "two points on one step" and "a gap" unrepresentable. Nothing is drawn before
 * `startStep`; after the last point the line holds the last BPM to the end of the content.
 */
export type Track = {
  id: string
  name: string
  /** Step of the first point (integer). */
  startStep: number
  /** bpms[i] is the BPM at step startStep + i. Never empty. Not clamped: see bpmMin/bpmMax. */
  bpms: number[]
  /** Offset into the source audio where playback starts, in seconds. */
  sourceOffset: number
  color?: string
}

/** Tracks by id. Display order is derived (see getOrderedTracks), not stored. */
export type TimelineState = {
  tracks: Record<string, Track>
  /** Project tempo in beats per minute: defines the step grid (step <-> seconds) and the ruler. */
  projectBpm: number
  /**
   * Visible BPM range of the lane area (bpmMin < bpmMax); higher BPM is drawn higher.
   * Points outside it are stored as-is and clamped only when drawn.
   */
  bpmMin: number
  bpmMax: number
}
