/** All times are in seconds. Pixels never appear in the model. */
export type Clip = {
  id: string
  trackId: string
  /** Timeline position of the clip's left edge. */
  start: number
  duration: number
  /** Offset into the source audio where playback starts (used by trim, milestone 3+). */
  sourceOffset: number
  name: string
  color?: string
}

export type Track = {
  id: string
  name: string
  clipIds: string[]
}

/** Normalized: entities by id, plus explicit track order. */
export type TimelineState = {
  tracks: Record<string, Track>
  trackOrder: string[]
  clips: Record<string, Clip>
}
