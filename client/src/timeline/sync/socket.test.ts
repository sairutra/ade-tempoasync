import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineState } from '../model/types'
import { TimelineSocket } from './socket'
import { createMockSocket, MockWebSocket } from './testSocket'

const state: TimelineState = {
  tracks: {
    a: { id: 'a', name: 'Lead', bpms: [100, 110], nodes: [0, 1], sourceOffset: 0, color: '#123456' },
  },
  projectBpm: 120,
  bpmMin: 60,
  bpmMax: 200,
}

let socket: TimelineSocket
beforeEach(() => {
  vi.useFakeTimers()
  MockWebSocket.instances = []
  socket = new TimelineSocket({ url: 'ws://test/ws', createSocket: createMockSocket, backoff: { minMs: 100, maxMs: 400 } })
})
afterEach(() => {
  socket.close()
  vi.useRealTimers()
})

function connected(): MockWebSocket {
  socket.connect()
  const ws = MockWebSocket.last()
  ws.open()
  ws.sent = []
  return ws
}

describe('TimelineSocket patches', () => {
  it('merges patches on one track into one message: union of ranges, latest values', () => {
    const ws = connected()
    socket.queuePatch('a', [0, 1, 2, 3, 4, 5, 6, 7], { from: 1, to: 3 })
    socket.queuePatch('a', [0, 10, 20, 30, 40, 50, 60, 70], { from: 5, to: 6 })
    expect(ws.sent).toEqual([])
    vi.advanceTimersByTime(30)
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 1, bpms: [10, 20, 30, 40, 50], length: 8 }])
  })

  it('flushes each track separately, and only once per batch', () => {
    const ws = connected()
    socket.queuePatch('a', [1, 2], { from: 0, to: 1 })
    socket.queuePatch('b', [3, 4], { from: 1, to: 2 })
    vi.advanceTimersByTime(30)
    vi.advanceTimersByTime(100)
    expect(ws.sent).toEqual([
      { type: 'patch', trackId: 'a', from: 0, bpms: [1], length: 2 },
      { type: 'patch', trackId: 'b', from: 1, bpms: [4], length: 2 },
    ])
  })

  it('clips a merged range to the latest array when the line got shorter', () => {
    const ws = connected()
    socket.queuePatch('a', [1, 2, 3, 4, 5], { from: 0, to: 5 })
    socket.queuePatch('a', [1, 2, 9], { from: 0, to: 3 })
    socket.flush()
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 0, bpms: [1, 2, 9], length: 3 }])
  })
})

describe('TimelineSocket connection', () => {
  it('sends a snapshot of `latest` on open, without view-only fields', () => {
    socket.latest = state
    socket.connect()
    MockWebSocket.last().open()
    expect(MockWebSocket.last().sent).toEqual([
      { type: 'snapshot', projectBpm: 120, tracks: [{ id: 'a', bpms: [100, 110] }] },
    ])
  })

  it('drops messages while not open', () => {
    socket.connect()
    const ws = MockWebSocket.last()
    socket.send({ type: 'projectBpm', bpm: 90 })
    socket.queuePatch('a', [1], { from: 0, to: 1 })
    vi.advanceTimersByTime(30)
    expect(ws.sent).toEqual([])
  })

  it('reconnects with doubling backoff and re-sends the snapshot', () => {
    socket.latest = state
    const first = connected()
    first.drop()
    vi.advanceTimersByTime(99)
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(2)

    MockWebSocket.last().drop() // failed attempt: next delay doubles
    vi.advanceTimersByTime(199)
    expect(MockWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    const third = MockWebSocket.last()
    expect(MockWebSocket.instances).toHaveLength(3)

    socket.latest = { ...state, projectBpm: 140 }
    third.open()
    expect(third.sent).toEqual([{ type: 'snapshot', projectBpm: 140, tracks: [{ id: 'a', bpms: [100, 110] }] }])

    third.drop() // a successful open resets the backoff
    vi.advanceTimersByTime(100)
    expect(MockWebSocket.instances).toHaveLength(4)
  })

  it('discards queued patches on (re)connect, since the snapshot covers them', () => {
    socket.latest = state
    socket.connect()
    socket.queuePatch('a', [100, 110], { from: 0, to: 2 })
    const ws = MockWebSocket.last()
    ws.open()
    vi.advanceTimersByTime(30)
    expect(ws.sent.map((m) => m.type)).toEqual(['snapshot'])
  })

  it('stops reconnecting after close()', () => {
    socket.connect()
    socket.close()
    vi.advanceTimersByTime(10_000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('can connect again after close() (StrictMode mounts, unmounts and remounts)', () => {
    socket.connect()
    socket.close()
    socket.latest = state
    socket.connect()
    expect(MockWebSocket.instances).toHaveLength(2)
    MockWebSocket.instances[0].open() // the stale socket's events are ignored
    expect(MockWebSocket.instances[0].sent).toEqual([])
    MockWebSocket.last().open()
    expect(MockWebSocket.last().sent).toHaveLength(1)
  })
})
