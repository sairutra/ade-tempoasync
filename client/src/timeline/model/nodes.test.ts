import { describe, expect, it } from 'vitest'
import { mockTimeline } from '../mock/mockTimeline'
import { modelReducer } from './editReducer'
import {
  addNode,
  clampShift,
  deriveNodes,
  isValidNodes,
  moveNode,
  nodeMoveRange,
  removeNode,
  roundBpm,
  setNodeBpm,
  shiftBpms,
} from './nodes'
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
    expect(mockTimeline.tracks.gtr.nodes).toEqual([0, 192, 287]) // hold until it enters, then one straight ramp
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

describe('removeNode', () => {
  // Nodes at 0, 2, 4, 6: up, down, up.
  const line = { bpms: [100, 110, 120, 110, 100, 110, 120], nodes: [0, 2, 4, 6] }

  it('removes the node and straightens the points between its neighbours', () => {
    const next = removeNode(line, 4)
    expect(next.nodes).toEqual([0, 2, 6])
    expect(next.bpms).toEqual([100, 110, 120, 120, 120, 120, 120])
    expectStraightBetweenNodes(next.bpms, next.nodes)
  })

  it('leaves segments outside the neighbours alone and does not mutate the input', () => {
    const next = removeNode(line, 2)
    expect(next.bpms.slice(4)).toEqual([100, 110, 120])
    expect(next.bpms.slice(0, 5)).toEqual([100, 100, 100, 100, 100])
    expect(line.bpms).toEqual([100, 110, 120, 110, 100, 110, 120])
    expect(line.nodes).toEqual([0, 2, 4, 6])
  })

  it('removing an added node restores the straight line', () => {
    const straight = { bpms: [100, 110, 120, 130, 140], nodes: [0, 4] }
    const bent = setNodeBpm(addNode(straight, 2), 2, 200)
    expect(removeNode(bent, 2)).toEqual(straight)
  })

  it('keeps the first and last nodes and rejects non-nodes', () => {
    expect(removeNode(line, 0)).toBe(line)
    expect(removeNode(line, 6)).toBe(line)
    expect(() => removeNode(line, 3)).toThrow()
  })
})

describe('nodeMoveRange / moveNode', () => {
  // Nodes at steps 0, 4, 8: up from 100 to 140, back to 100.
  const line = { bpms: [100, 110, 120, 130, 140, 130, 120, 110, 100], nodes: [0, 4, 8] }

  it('an interior node stays strictly between its neighbours', () => {
    expect(nodeMoveRange(line, 4)).toEqual({ min: 1, max: 7 })
  })

  it('the first node is pinned to step 0; the last node moves forward without limit', () => {
    expect(nodeMoveRange(line, 0)).toEqual({ min: 0, max: 0 })
    expect(nodeMoveRange(line, 8)).toEqual({ min: 5, max: Infinity })
    expect(nodeMoveRange({ bpms: [90], nodes: [0] }, 0)).toEqual({ min: 0, max: 0 })
  })

  it('throws for a step that is not a node', () => {
    expect(() => nodeMoveRange(line, 2)).toThrow()
    expect(() => moveNode(line, 2, 3)).toThrow()
  })

  it('moves an interior node, keeping its BPM and redrawing both segments', () => {
    const moved = moveNode(line, 4, 2)
    expect(moved.nodes).toEqual([0, 2, 8])
    expect(moved.bpms).toHaveLength(9)
    expect(moved.bpms[2]).toBe(140)
    expect(moved.bpms[0]).toBe(100)
    expect(moved.bpms[8]).toBe(100)
    expectStraightBetweenNodes(moved.bpms, moved.nodes)
  })

  it('clamps to one step from each neighbour, never onto or past it', () => {
    expect(moveNode(line, 4, -10).nodes).toEqual([0, 1, 8])
    expect(moveNode(line, 4, 0).nodes).toEqual([0, 1, 8])
    expect(moveNode(line, 4, 99).nodes).toEqual([0, 7, 8])
    expect(moveNode(line, 4, 8).nodes).toEqual([0, 7, 8])
  })

  it('returns the same line when the node does not move', () => {
    expect(moveNode(line, 4, 4)).toBe(line)
    expect(moveNode(line, 4, 4.2)).toBe(line) // rounded to the nearest step
  })

  it('is lossless: moving a node back restores the line', () => {
    const back = moveNode(moveNode(line, 4, 1), 1, 4)
    expect(back.nodes).toEqual(line.nodes)
    back.bpms.forEach((bpm, i) => expect(bpm).toBeCloseTo(line.bpms[i], 9))
  })

  it('never moves the first node, so the line always starts at step 0', () => {
    for (const to of [-5, 2, 3, 50]) expect(moveNode(line, 0, to)).toBe(line)
    const one = { bpms: [90], nodes: [0] }
    expect(moveNode(one, 0, 7)).toBe(one)
  })

  it('moving the last node stretches or shrinks the line', () => {
    const longer = moveNode(line, 8, 12)
    expect(longer.nodes).toEqual([0, 4, 12])
    expect(longer.bpms).toHaveLength(13)
    expect(longer.bpms[12]).toBe(100)
    expectStraightBetweenNodes(longer.bpms, longer.nodes)
    const shorter = moveNode(line, 8, 0)
    expect(shorter.nodes).toEqual([0, 4, 5])
    expect(shorter.bpms).toEqual([100, 110, 120, 130, 140, 100])
  })

  it('every result keeps valid nodes', () => {
    for (const [index, to] of [[0, 2], [4, 1], [4, 7], [8, 5], [8, 40]]) {
      const moved = moveNode(line, index, to)
      expect(isValidNodes(moved.nodes, moved.bpms.length)).toBe(true)
    }
  })
})

describe('shiftBpms / clampShift', () => {
  it('moves every point by the same amount, keeping the shape', () => {
    expect(shiftBpms([100, 110, 120], 5)).toEqual([105, 115, 125])
  })

  it('stops the line at the range edges', () => {
    const bpms = [100, 150, 120]
    expect(clampShift(bpms, 10, 60, 200)).toBe(10)
    expect(clampShift(bpms, 80, 60, 200)).toBe(50) // highest point hits 200
    expect(clampShift(bpms, -80, 60, 200)).toBe(-40) // lowest point hits 60
  })

  it('a line already out of range can move back in but not further out', () => {
    const bpms = [250, 100]
    expect(clampShift(bpms, 10, 60, 200)).toBe(0)
    expect(clampShift(bpms, -30, 60, 200)).toBe(-30)
    expect(clampShift(bpms, -60, 60, 200)).toBe(-40)
  })
})

describe('modelReducer', () => {
  const state = createTimelineState([
    { id: 'a', name: 'A', bpms: [100, 100, 100], sourceOffset: 0 },
    { id: 'b', name: 'B', bpms: [90], sourceOffset: 0 },
  ])

  it('replaces only the edited track', () => {
    const added = modelReducer(state, { type: 'addNode', trackId: 'a', index: 1 })
    const moved = modelReducer(added, { type: 'setNodeBpm', trackId: 'a', index: 1, bpm: 120 })
    expect(moved.tracks.a.bpms).toEqual([100, 120, 100])
    expect(moved.tracks.a.nodes).toEqual([0, 1, 2])
    expect(moved.tracks.b).toBe(state.tracks.b)
  })

  it('removes nodes and shifts lines', () => {
    const bent = modelReducer(modelReducer(state, { type: 'addNode', trackId: 'a', index: 1 }), {
      type: 'setNodeBpm',
      trackId: 'a',
      index: 1,
      bpm: 120,
    })
    const removed = modelReducer(bent, { type: 'removeNode', trackId: 'a', index: 1 })
    expect(removed.tracks.a.bpms).toEqual([100, 100, 100])
    expect(removed.tracks.a.nodes).toEqual([0, 2])
    const shifted = modelReducer(bent, { type: 'shiftLine', trackId: 'a', base: bent.tracks.a.bpms, delta: -10 })
    expect(shifted.tracks.a.bpms).toEqual([90, 110, 90])
    expect(shifted.tracks.a.nodes).toBe(bent.tracks.a.nodes)
    expect(shifted.tracks.b).toBe(state.tracks.b)
  })

  it('ignores a shift whose base no longer matches the line', () => {
    expect(modelReducer(state, { type: 'shiftLine', trackId: 'a', base: [1, 2], delta: 5 })).toBe(state)
  })

  it('returns the same state for no-ops and unknown tracks', () => {
    expect(modelReducer(state, { type: 'addNode', trackId: 'a', index: 0 })).toBe(state)
    expect(modelReducer(state, { type: 'addNode', trackId: 'zz', index: 1 })).toBe(state)
    expect(modelReducer(state, { type: 'removeNode', trackId: 'a', index: 0 })).toBe(state)
  })
})

describe('modelReducer moveNode', () => {
  const state = createTimelineState([
    { id: 'a', name: 'A', bpms: [100, 110, 120, 110, 100], nodes: [0, 2, 4], sourceOffset: 0 },
    { id: 'b', name: 'B', bpms: [90, 90], sourceOffset: 0 },
  ])

  it('moves by step, and only the edited track gets a new object', () => {
    const next = modelReducer(state, { type: 'moveNode', trackId: 'a', fromStep: 2, toStep: 3 })
    expect(next.tracks.a.nodes).toEqual([0, 3, 4])
    expect(next.tracks.a.bpms[3]).toBe(120)
    expect(next.tracks.b).toBe(state.tracks.b)
  })

  it('leaves the first node at step 0', () => {
    expect(modelReducer(state, { type: 'moveNode', trackId: 'a', fromStep: 0, toStep: 1 })).toBe(state)
  })

  it('ignores a step that is not a node, an unknown track, and a no-op move', () => {
    expect(modelReducer(state, { type: 'moveNode', trackId: 'a', fromStep: 1, toStep: 2 })).toBe(state)
    expect(modelReducer(state, { type: 'moveNode', trackId: 'zz', fromStep: 2, toStep: 3 })).toBe(state)
    expect(modelReducer(state, { type: 'moveNode', trackId: 'a', fromStep: 2, toStep: 2 })).toBe(state)
    expect(modelReducer(state, { type: 'moveNode', trackId: 'a', fromStep: 2, toStep: 4 }).tracks.a.nodes).toEqual([0, 3, 4])
  })
})

describe('createTimelineState nodes', () => {
  it('keeps given nodes and rejects invalid ones', () => {
    const ok = createTimelineState([{ id: 'a', name: 'A', bpms: [1, 2, 3], nodes: [0, 1, 2], sourceOffset: 0 }])
    expect(ok.tracks.a.nodes).toEqual([0, 1, 2])
    for (const nodes of [[1, 2], [0, 1], [0, 2, 1, 2], [0, 0.5, 2]]) {
      expect(() => createTimelineState([{ id: 'a', name: 'A', bpms: [1, 2, 3], nodes, sourceOffset: 0 }])).toThrow()
    }
  })
})

it('roundBpm rounds to 0.1 BPM', () => {
  expect(roundBpm(120.04)).toBeCloseTo(120)
  expect(roundBpm(120.06)).toBeCloseTo(120.1)
})
