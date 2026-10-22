import type { TimelineState } from '../model/types'

/**
 * Client → server messages (JSON). The client is the source of truth: it sends a full snapshot on
 * every connect, then only what changed. Per track, only `bpms` (bpms[i] is the BPM at step i, what
 * playback reads), `channel` (1–16) and `sequence` (1–16 MIDI notes 0–127, -1 = rest), each when the
 * track has one, are sent; nodes, colour, name and the view's BPM range stay on the client.
 */
export type ClientMessage =
  | { type: 'snapshot'; projectBpm: number; tracks: { id: string; bpms: number[]; channel?: number; sequence?: number[] }[] }
  | { type: 'addTrack'; id: string; bpms: number[]; channel?: number; sequence?: number[] }
  /** The track's MIDI sequence was replaced (edit dialog). */
  | { type: 'sequence'; trackId: string; sequence: number[] }
  /**
   * Steps [from, to) of the track changed; `bpms` holds their new values (bpms.length === to - from).
   * `lineLength` is the track's step count after the patch: steps at and past it are dropped (the
   * line got shorter, e.g. the last node moved back). When `lineLength` differs from the current
   * length, `to === lineLength`. Every step outside [from, to) and below `lineLength` is unchanged.
   */
  | { type: 'patch'; trackId: string; from: number; to: number; bpms: number[]; lineLength: number }
  | { type: 'projectBpm'; bpm: number }
  /** The transport started (play button or Space): the server starts every channel's sequence player. */
  | { type: 'start' }
  /** The transport paused, stopped, or reached the end: the server stops every channel's sequence player. */
  | { type: 'stop' }

/** Adds `channel` only when set, so tracks without one send exactly what they did before. */
export function withChannel<T extends object>(msg: T, channel: number | undefined): T & { channel?: number } {
  return channel === undefined ? msg : { ...msg, channel }
}

/** Adds `sequence` only when set, like withChannel. */
export function withSequence<T extends object>(msg: T, sequence: number[] | undefined): T & { sequence?: number[] } {
  return sequence === undefined ? msg : { ...msg, sequence }
}

export function snapshotMessage(state: TimelineState): ClientMessage {
  return {
    type: 'snapshot',
    projectBpm: state.projectBpm,
    tracks: Object.values(state.tracks).map((t) =>
      withSequence(withChannel({ id: t.id, bpms: t.bpms }, t.channel), t.sequence),
    ),
  }
}
