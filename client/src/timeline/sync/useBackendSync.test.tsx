// @vitest-environment jsdom
import { act, StrictMode, useEffect, useReducer, useState, type ActionDispatch, type Dispatch, type SetStateAction } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { modelReducer, type ModelAction } from '../model/editReducer'
import type { TimelineState } from '../model/types'
import { TimelineSocket } from './socket'
import { createMockSocket, MockWebSocket } from './testSocket'
import { sendModelChanges, useBackendSync, type BackendSink } from './useBackendSync'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const flat = (n: number, bpm: number) => Array<number>(n).fill(bpm)

const initial: TimelineState = {
  tracks: {
    a: { id: 'a', name: 'A', bpms: flat(9, 100), nodes: [0, 2, 4, 6, 8], sourceOffset: 0 },
    b: { id: 'b', name: 'B', bpms: flat(9, 90), nodes: [0, 8], sourceOffset: 0 },
  },
  projectBpm: 120,
  bpmMin: 60,
  bpmMax: 200,
}

let socket: TimelineSocket
let root: Root
let dispatch: ActionDispatch<[ModelAction]>
let setPaused: Dispatch<SetStateAction<boolean>>

function Harness() {
  const [model, d] = useReducer(modelReducer, initial)
  const [paused, p] = useState(false)
  useEffect(() => {
    dispatch = d
    setPaused = p
  }, [d, p])
  useBackendSync(model, socket, paused)
  return null
}

/** Renders the harness, connects, and returns the socket with the connect snapshot cleared. */
function mount(strict = false): MockWebSocket {
  socket = new TimelineSocket({ url: 'ws://test/ws', createSocket: createMockSocket })
  root = createRoot(document.createElement('div'))
  act(() => root.render(strict ? <StrictMode><Harness /></StrictMode> : <Harness />))
  socket.connect()
  const ws = MockWebSocket.last()
  ws.open()
  expect(ws.sent.map((m) => m.type)).toEqual(['snapshot'])
  ws.sent = []
  return ws
}

function edit(action: ModelAction) {
  act(() => dispatch(action))
  vi.advanceTimersByTime(30)
}

beforeEach(() => {
  vi.useFakeTimers()
  MockWebSocket.instances = []
})
afterEach(() => {
  act(() => root.unmount())
  socket.close()
  vi.useRealTimers()
})

describe('useBackendSync', () => {
  it('sends nothing for the initial model (the connect snapshot covers it)', () => {
    const ws = mount()
    vi.advanceTimersByTime(100)
    expect(ws.sent).toEqual([])
  })

  it('setNodeBpm sends a patch covering only the segments either side of the node', () => {
    const ws = mount()
    edit({ type: 'setNodeBpm', trackId: 'a', index: 4, bpm: 120 })
    // nodes 2 and 6 stay at 100; steps 3..5 are redrawn
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 3, to: 6, bpms: [110, 120, 110], lineLength: 9 }])
  })

  it('shiftLine sends a full-range patch', () => {
    const ws = mount()
    edit({ type: 'shiftLine', trackId: 'a', base: initial.tracks.a.bpms, delta: 5 })
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 0, to: 9, bpms: flat(9, 105), lineLength: 9 }])
  })

  it('moving the last node back on a flat line sends only the cut: an empty range and the shorter lineLength', () => {
    const ws = mount()
    edit({ type: 'moveNode', trackId: 'a', fromStep: 8, toStep: 7 })
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 8, to: 8, bpms: [], lineLength: 8 }])
  })

  it('moving the last node back sends only the redrawn segment after the previous node, not the whole line', () => {
    const ws = mount()
    edit({ type: 'setNodeBpm', trackId: 'a', index: 6, bpm: 120 })
    ws.sent = []
    edit({ type: 'moveNode', trackId: 'a', fromStep: 8, toStep: 7 })
    // steps 0..6 are unchanged; step 7 is redrawn between node 6 (120) and the moved end (100)
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 7, to: 8, bpms: [100], lineLength: 8 }])
  })

  it('an edit on one track sends nothing for the others', () => {
    const ws = mount()
    edit({ type: 'setNodeBpm', trackId: 'b', index: 8, bpm: 98 })
    expect(ws.sent.map((m) => m.type === 'patch' && m.trackId)).toEqual(['b'])
  })

  it('merges a drag (many dispatches within one flush) into one patch with the final values', () => {
    const ws = mount()
    act(() => {
      dispatch({ type: 'setNodeBpm', trackId: 'a', index: 2, bpm: 110 })
      dispatch({ type: 'setNodeBpm', trackId: 'a', index: 6, bpm: 110 })
    })
    act(() => dispatch({ type: 'setNodeBpm', trackId: 'a', index: 6, bpm: 104 }))
    vi.advanceTimersByTime(30)
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 1, to: 8, bpms: [105, 110, 105, 100, 102, 104, 102], lineLength: 9 }])
  })

  it('sends nothing for edits that leave bpms untouched (adding a node, the BPM range)', () => {
    const ws = mount()
    edit({ type: 'addNode', trackId: 'b', index: 3 })
    edit({ type: 'setBpmRange', bpmMin: 80, bpmMax: 180 })
    expect(ws.sent).toEqual([])
  })

  it('sends addTrack for a new track', () => {
    const ws = mount()
    edit({ type: 'addTrack', track: { name: 'Bass', color: '#00ff00', bpm: 128, channel: 10, sequence: [60, -1, -1, -1] } })
    expect(ws.sent).toHaveLength(1)
    expect(ws.sent[0]).toMatchObject({ type: 'addTrack', id: 'bass', channel: 10, sequence: [60, -1, -1, -1] })
    expect((ws.sent[0] as { bpms: number[] }).bpms.every((b) => b === 128)).toBe(true)
  })

  it('sends a sequence message, and no patch, when only the sequence is edited', () => {
    const ws = mount()
    edit({ type: 'editTrack', trackId: 'a', changes: { sequence: [64, -1, 67, -1] } })
    expect(ws.sent).toEqual([{ type: 'sequence', trackId: 'a', sequence: [64, -1, 67, -1] }])
    edit({ type: 'editTrack', trackId: 'a', changes: { sequence: [64, -1, 67, -1] } })
    expect(ws.sent).toHaveLength(1)
  })

  it('sends each edit once under StrictMode', () => {
    const ws = mount(true)
    edit({ type: 'setNodeBpm', trackId: 'a', index: 4, bpm: 120 })
    edit({ type: 'addTrack', track: { name: 'Bass', color: '#00ff00', bpm: 128, channel: 10, sequence: [60, -1, -1, -1] } })
    expect(ws.sent.map((m) => m.type)).toEqual(['patch', 'addTrack'])
  })

  it('sends nothing while paused (dragging), then one patch with the final values on resume', () => {
    const ws = mount()
    act(() => setPaused(true))
    edit({ type: 'setNodeBpm', trackId: 'a', index: 4, bpm: 110 })
    edit({ type: 'setNodeBpm', trackId: 'a', index: 4, bpm: 130 })
    edit({ type: 'setNodeBpm', trackId: 'a', index: 4, bpm: 120 })
    expect(ws.sent).toEqual([])
    act(() => setPaused(false))
    vi.advanceTimersByTime(30)
    expect(ws.sent).toEqual([{ type: 'patch', trackId: 'a', from: 3, to: 6, bpms: [110, 120, 110], lineLength: 9 }])
  })

  it('a paused drag that ends where it started sends nothing', () => {
    const ws = mount()
    act(() => setPaused(true))
    edit({ type: 'shiftLine', trackId: 'b', base: initial.tracks.b.bpms, delta: 4 })
    edit({ type: 'shiftLine', trackId: 'b', base: initial.tracks.b.bpms, delta: 0 })
    act(() => setPaused(false))
    vi.advanceTimersByTime(30)
    expect(ws.sent).toEqual([])
  })

  it('keeps socket.latest current while paused', () => {
    mount()
    act(() => setPaused(true))
    edit({ type: 'shiftLine', trackId: 'b', base: initial.tracks.b.bpms, delta: 2 })
    expect(socket.latest?.tracks.b.bpms).toEqual(flat(9, 92))
  })

  it('keeps socket.latest current for the reconnect snapshot', () => {
    const ws = mount()
    edit({ type: 'shiftLine', trackId: 'b', base: initial.tracks.b.bpms, delta: 1 })
    ws.drop()
    vi.advanceTimersByTime(500)
    MockWebSocket.last().open()
    expect(MockWebSocket.last().sent[0]).toEqual({
      type: 'snapshot',
      projectBpm: 120,
      tracks: [
        { id: 'a', bpms: flat(9, 100) },
        { id: 'b', bpms: flat(9, 91) },
      ],
    })
  })
})

describe('sendModelChanges', () => {
  it('sends projectBpm when it changes', () => {
    const sink: BackendSink = { latest: null, send: vi.fn(), queuePatch: vi.fn() }
    sendModelChanges(initial, { ...initial, projectBpm: 140 }, sink)
    expect(sink.send).toHaveBeenCalledExactlyOnceWith({ type: 'projectBpm', bpm: 140 })
    expect(sink.queuePatch).not.toHaveBeenCalled()
  })
})
