/**
 * Horizontal positions are integer steps (1 step = one 16th note at `projectBpm`, see tempo.ts);
 * vertical positions are BPM. Pixels never appear in the model.
 *
 * A track is a BPM curve with exactly one point per step and no gaps: point i sits at step i with
 * BPM `bpms[i]`. Every line starts at step 0 and, after its last point, holds the last BPM to the
 * end of the timeline. Storing a dense array from step 0 (rather than x per point, or a start
 * offset) makes "two points on one step", "a gap" and "a line that starts late" unrepresentable.
 *
 * `nodes` are the editing nodes: indices into `bpms` where the line may bend. Between two
 * consecutive nodes the points lie on the straight line joining them (see model/nodes.ts), so the
 * nodes are the shape and `bpms` is that shape sampled once per step (what playback reads).
 */
export type Track = {
  id: string
  name: string
  /** bpms[i] is the BPM at step i. Never empty. Not clamped: see bpmMin/bpmMax. */
  bpms: number[]
  /**
   * Indices into `bpms`, strictly increasing, always containing 0 and bpms.length - 1.
   * Derived from `bpms` on load when absent (see createTimelineState).
   */
  nodes: number[]
  /** Offset into the source audio where playback starts, in seconds. */
  sourceOffset: number
  color?: string
  /** Output channel, an integer in [CHANNEL_MIN, CHANNEL_MAX] (see newTrack.ts). Absent on tracks loaded without one. */
  channel?: number
}

/** A track as supplied from outside: nodes are derived from the points when omitted. */
export type TrackInput = Omit<Track, 'nodes'> & { nodes?: number[] }

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
