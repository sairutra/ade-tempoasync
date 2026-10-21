import { useEffect, useRef } from 'react'
import type { TimelineState } from '../model/types'
import { changedRange } from './diff'
import type { TimelineSocket } from './socket'

export type BackendSink = Pick<TimelineSocket, 'latest' | 'send' | 'queuePatch'>

/**
 * Sends what changed between two models. The reducer gives a new object only to the edited track,
 * and `bpms` is replaced whenever its values change, so an unchanged `bpms` reference means nothing
 * to send for that track (a node added on the line, a rename or a colour change send nothing).
 */
export function sendModelChanges(prev: TimelineState, next: TimelineState, sink: BackendSink): void {
  if (next.projectBpm !== prev.projectBpm) sink.send({ type: 'projectBpm', bpm: next.projectBpm })
  for (const track of Object.values(next.tracks)) {
    const old = prev.tracks[track.id]
    if (old?.bpms === track.bpms) continue
    if (!old) {
      sink.send({ type: 'addTrack', id: track.id, bpms: track.bpms })
      continue
    }
    const range = changedRange(old.bpms, track.bpms)
    if (range) sink.queuePatch(track.id, track.bpms, range)
  }
}

/**
 * Streams model edits to the backend. Compares each model with the last one it sent; the
 * initial model is not sent here, because the socket's snapshot on connect covers it.
 * While `paused` (a drag is in progress) nothing is sent and the last sent model stays the baseline,
 * so releasing the drag sends the whole gesture as one change.
 * StrictMode-safe: a re-run of the effect for the same model finds nothing changed.
 */
export function useBackendSync(model: TimelineState, socket: BackendSink, paused = false): void {
  const prevRef = useRef(model)
  useEffect(() => {
    // The socket is an external object, not React state: keeping it current is this effect's job.
    // oxlint-disable-next-line react/immutability
    socket.latest = model
    if (paused) return
    const prev = prevRef.current
    prevRef.current = model
    if (prev !== model) sendModelChanges(prev, model, socket)
  }, [model, socket, paused])
}
