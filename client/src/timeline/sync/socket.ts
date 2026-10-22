import type { TimelineState } from '../model/types'
import type { Range } from './diff'
import { snapshotMessage, type ClientMessage } from './protocol'

/** The part of the browser WebSocket this class uses (so tests can pass a mock). */
export type SocketLike = {
  readonly readyState: number
  send(data: string): void
  close(): void
  onopen: ((ev: Event) => void) | null
  onclose: ((ev: CloseEvent) => void) | null
}

export type TimelineSocketOptions = {
  /** Defaults to `/ws` on the page's host (proxied to the backend by Vite in dev). */
  url?: string
  createSocket?: (url: string) => SocketLike
  /** Pending patches are sent at most this often, in ms. */
  flushMs?: number
  /** Reconnect delay doubles from `minMs` per failed attempt, up to `maxMs`. */
  backoff?: { minMs: number; maxMs: number }
}

const OPEN = 1 // WebSocket.OPEN, without needing the global

function defaultUrl(): string {
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
}

type PendingPatch = Range & { bpms: readonly number[] }

/**
 * Sends model changes to the backend. Messages sent while disconnected are dropped: every (re)connect
 * starts with a snapshot of `latest`, which covers them. Construction does no I/O (and touches no
 * browser globals); call connect().
 */
export class TimelineSocket {
  /** The current model, kept up to date by useBackendSync; the snapshot on (re)connect is built from it. */
  latest: TimelineState | null = null

  private readonly url: string | undefined
  private readonly createSocket: (url: string) => SocketLike
  private readonly flushMs: number
  private readonly backoff: { minMs: number; maxMs: number }

  private ws: SocketLike | null = null
  private stopped = true
  private attempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly pending = new Map<string, PendingPatch>()

  constructor(options: TimelineSocketOptions = {}) {
    this.url = options.url
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url))
    this.flushMs = options.flushMs ?? 30
    this.backoff = options.backoff ?? { minMs: 500, maxMs: 10_000 }
  }

  /** Opens the connection and keeps it open (reconnecting with backoff) until close(). */
  connect(): void {
    if (!this.stopped) return
    this.stopped = false
    this.open()
  }

  /** Closes the connection and stops reconnecting. connect() may be called again afterwards. */
  close(): void {
    this.stopped = true
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.clearPending()
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  /** Sends `msg` if connected, otherwise drops it (the snapshot on reconnect covers it). */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === OPEN) this.ws.send(JSON.stringify(msg))
  }

  /**
   * Queues a patch of `bpms[range]` for a track. Patches for the same track merge until the next
   * flush: the range becomes the union, and the latest `bpms` provides the values.
   */
  queuePatch(trackId: string, bpms: readonly number[], range: Range): void {
    const prev = this.pending.get(trackId)
    this.pending.set(
      trackId,
      prev ? { bpms, from: Math.min(prev.from, range.from), to: Math.max(prev.to, range.to) } : { bpms, ...range },
    )
    this.flushTimer ??= setTimeout(() => this.flush(), this.flushMs)
  }

  /** Sends every pending patch now. */
  flush(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
    for (const [trackId, { bpms, from, to }] of this.pending) {
      // An earlier patch in the union may have covered a longer line than the latest one.
      const end = Math.min(to, bpms.length)
      const start = Math.min(from, end)
      // An empty range is still sent: it means the line was only cut short to `lineLength`.
      this.send({ type: 'patch', trackId, from: start, to: end, bpms: bpms.slice(start, end), lineLength: bpms.length })
    }
    this.pending.clear()
  }

  private clearPending(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.pending.clear()
  }

  private open(): void {
    const ws = this.createSocket(this.url ?? defaultUrl())
    this.ws = ws
    ws.onopen = () => {
      if (this.ws !== ws) return
      this.attempts = 0
      // `latest` already includes every queued change, so the snapshot supersedes them.
      this.clearPending()
      if (this.latest) this.send(snapshotMessage(this.latest))
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      if (!this.stopped) this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    const { minMs, maxMs } = this.backoff
    const delay = Math.min(maxMs, minMs * 2 ** this.attempts)
    this.attempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.open()
    }, delay)
  }
}
