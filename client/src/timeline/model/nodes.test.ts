import { describe, expect, it } from 'vitest'
import { mockTimeline } from '../mock/mockTimeline'
import { modelReducer } from './editReducer'
import { addNode, deriveNodes, isValidNodes, roundBpm, setNodeBpm } from './nodes'
import { createTimelineState } from './selectors'

/** Every point between consecutive nodes lies on the straight line joining them. */
function expectStraightBetweenNodes(bpms: number[], nodes: number[], tolerance = 1e-9) {
  for (let k = 1; k < nodes.length; k++) {
    const [a, b] = [nodes[k - 1], nodes[k]]
    for (let i = a + 1; i < b; i++) {
      expect(Math.abs(bpms[i] - (bpms[a] + ((bpms[b] - bpms[a]) * (i - a)) / (b - a)))).toBeLessThanOrEqual(tolerance)
    }
  }
}

describe('deriveNodes', () => {
  it('a single point is one node; a straight line is just its ends', () => {
    expect(deriveNodes([120])).toEqual([0])
    expect(deriveNodes([100, 110, 120, 130])).toEqual([0, 3])
    expect(deriveNodes([90, 90, 90])).toEqual([0, 2])
  })

  it('puts a node wherever the direction changes', () => {
    // flat, ramp up, flat, ramp down
    expect(deriveNodes([100, 100, 100, 110, 120, 120, 110])).toEqual([0, 2, 4, 5, 6])
  })

  it('a step jump gives a node on both sides of it', () => {
    expect(deriveNodes([90, 90, 90, 110, 110])).toEqual([0, 2, 3, 4])
  })

  it('ignores rounding wobble on a straight ramp', () => {
    const ramp = Array.from({ length: 33 }, (_, i) => Math.round((120 + (20 * i) / 32) * 10) / 10)
    expect(deriveNodes(ramp)).toEqual([0, 32])
  })

  it('every mock track gets valid nodes that describe its shape', () => {
    for (const t of Object.values(mockTimeline.tracks)) {
      expect(isValidNodes(t.nodes, t.bpms.length)).toBe(true)
      expectStraightBetweenNodes(t.bpms, t.nodes, 0.1 + 1e-9)
    }
    expect(mockTimeline.tracks.drums.nodes).toEqual([0, 128, 160, 479]) // hold, ramp, hold
    expect(mockTimeline.tracks.gtr.nodes).toEqual([0, 95]) // one straight ramp
  })
})

describe('setNodeBpm', () => {
  const line = { bpms: [100, 100, 100, 100, 100], nodes: [0, 2, 4] }

  it('moves the node and redraws both neighbouring segments step by step', () => {
    const next = setNodeBpm(line, 2, 140)
    expect(next.bpms).toEqual([100, 120, 140, 120, 100])
    expect(next.nodes).toBe(line.nodes)
    expect(line.bpms).toEqual([100, 100, 100, 100, 100]) // input untouched
  })

  it('moving an end node only redraws its one segment', () => {
    expect(setNodeBpm(line, 0, 60).bpms).toEqual([60, 80, 100, 100, 100])
    expect(setNodeBpm(line, 4, 60).bpms).toEqual([100, 100, 100, 80, 60])
  })

  it('leaves segments beyond the neighbours alone', () => {
    const wide = { bpms: [100, 105, 110, 110, 110, 90, 70], nodes: [0, 2, 4, 6] }
    expect(setNodeBpm(wide, 4, 130).bpms).toEqual([100, 105, 110, 120, 130, 100, 70])
  })

  it('returns the same line for a no-op and rejects non-nodes', () => {
    expect(setNodeBpm(line, 2, 100)).toBe(line)
    expect(() => setNodeBpm(line, 1, 120)).toThrow()
  })
})

describe('addNode', () => {
  const line = { bpms: [100, 110, 120, 130, 140], nodes: [0, 4] }

  it('inserts a node in order without changing the shape', () => {
    const next = addNode(line, 2)
    expect(next.nodes).toEqual([0, 2, 4])
    expect(next.bpms).toBe(line.bpms)
  })

  it('after adding, dragging the new node bends the line there', () => {
    const next = setNodeBpm(addNode(line, 2), 2, 80)
    expect(next.bpms).toEqual([100, 90, 80, 110, 140])
  })

  it('ignores an existing node', () => {
    expect(addNode(line, 4)).toBe(line)
  })

  it('past the last point it extends the line, holding the last BPM', () => {
    const next = addNode(line, 7)
    expect(next.bpms).toEqual([100, 110, 120, 130, 140, 140, 140, 140])
    expect(next.nodes).toEqual([0, 4, 7])
    expect(setNodeBpm(next, 7, 110).bpms).toEqual([100, 110, 120, 130, 140, 130, 120, 110])
  })
})

describe('modelReducer', () => {
  const state = createTimelineState([
    { id: 'a', name: 'A', startStep: 0, bpms: [100, 100, 100], sourceOffset: 0 },
    { id: 'b', name: 'B', startStep: 4, bpms: [90], sourceOffset: 0 },
  ])

  it('replaces only the edited track', () => {
    const added = modelReducer(state, { type: 'addNode', trackId: 'a', index: 1 })
    const moved = modelReducer(added, { type: 'setNodeBpm', trackId: 'a', index: 1, bpm: 120 })
    expect(moved.tracks.a.bpms).toEqual([100, 120, 100])
    expect(moved.tracks.a.nodes).toEqual([0, 1, 2])
    expect(moved.tracks.b).toBe(state.tracks.b)
  })

  it('returns the same state for no-ops and unknown tracks', () => {
    expect(modelReducer(state, { type: 'addNode', trackId: 'a', index: 0 })).toBe(state)
    expect(modelReducer(state, { type: 'addNode', trackId: 'zz', index: 1 })).toBe(state)
  })
})

describe('createTimelineState nodes', () => {
  it('keeps given nodes and rejects invalid ones', () => {
    const ok = createTimelineState([{ id: 'a', name: 'A', startStep: 0, bpms: [1, 2, 3], nodes: [0, 1, 2], sourceOffset: 0 }])
    expect(ok.tracks.a.nodes).toEqual([0, 1, 2])
    for (const nodes of [[1, 2], [0, 1], [0, 2, 1, 2], [0, 0.5, 2]]) {
      expect(() => createTimelineState([{ id: 'a', name: 'A', startStep: 0, bpms: [1, 2, 3], nodes, sourceOffset: 0 }])).toThrow()
    }
  })
})

it('roundBpm rounds to 0.1 BPM', () => {
  expect(roundBpm(120.04)).toBeCloseTo(120)
  expect(roundBpm(120.06)).toBeCloseTo(120.1)
})
