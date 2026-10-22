import type { TransportClock } from '../playback/transportClock'
import type { TimelineSocket } from './socket'

export type TransportSink = Pick<TimelineSocket, 'send' | 'flush'>

/**
 * Sends { type: 'start' } / { type: 'stop' } whenever the clock starts or stops playing. The play
 * button and Space both go through the clock, so this is the one place the transport reaches the
 * backend; it also covers the clock pausing itself at the end of the timeline. Seeks and a stop
 * while already stopped don't change `playing`, so they send nothing.
 *
 * Pending patches are flushed before 'start', so the server builds its steps from the current BPMs.
 * Returns the unsubscribe function.
 */
export function syncTransport(clock: Pick<TransportClock, 'subscribe' | 'getState'>, sink: TransportSink): () => void {
  let playing = clock.getState().playing
  return clock.subscribe(() => {
    const next = clock.getState().playing
    if (next === playing) return
    playing = next
    if (next) {
      sink.flush()
      sink.send({ type: 'start' })
    } else {
      sink.send({ type: 'stop' })
    }
  })
}
