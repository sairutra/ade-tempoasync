import type { TimelineState } from '../model/types'

/**
 * Client → server messages (JSON). The client is the source of truth: it sends a full snapshot on
 * every connect, then only what changed. Per track, only `bpms` (bpms[i] is the BPM at step i, what
 * playback reads) and `channel` (1–16, when the track has one) are sent; nodes, colour, name and the
 * view's BPM range stay on the client.
 */
export type ClientMessage =
  | { type: 'snapshot'; projectBpm: number; tracks: { id: string; bpms: number[]; channel?: number }[] }
  | { type: 'addTrack'; id: string; bpms: number[]; channel?: number }
  /**
   * Replaces the track's bpms[from .. from + bpms.length), then sets the line to `length` steps
   * (cutting the end when the line got shorter, e.g. the last node moved back).
   */
  | { type: 'patch'; trackId: string; from: number; bpms: number[]; length: number }
  | { type: 'projectBpm'; bpm: number }

/** Adds `channel` only when set, so tracks without one send exactly what they did before. */
export function withChannel<T extends object>(msg: T, channel: number | undefined): T & { channel?: number } {
  return channel === undefined ? msg : { ...msg, channel }
}

export function snapshotMessage(state: TimelineState): ClientMessage {
  return {
    type: 'snapshot',
    projectBpm: state.projectBpm,
    tracks: Object.values(state.tracks).map((t) => withChannel({ id: t.id, bpms: t.bpms }, t.channel)),
  }
}
