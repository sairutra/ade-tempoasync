import { describe, expect, it } from 'vitest'
import { modelReducer } from './editReducer'
import { BPM_RANGE_CEIL, BPM_RANGE_FLOOR, createTimelineState, MIN_BPM_SPAN, normalizeBpmRange } from './selectors'

describe('normalizeBpmRange', () => {
  it('keeps a valid range, rounded to whole BPM', () => {
    expect(normalizeBpmRange(70.4, 180.6)).toEqual({ bpmMin: 70, bpmMax: 181 })
  })

  it('pushes the other end when the edited end crosses it', () => {
    expect(normalizeBpmRange(250, 200, 'min')).toEqual({ bpmMin: 250, bpmMax: 250 + MIN_BPM_SPAN })
    expect(normalizeBpmRange(60, 30, 'max')).toEqual({ bpmMin: 30 - MIN_BPM_SPAN, bpmMax: 30 })
  })

  it('stays inside the hard limits', () => {
    expect(normalizeBpmRange(-5, 5000, 'min')).toEqual({ bpmMin: BPM_RANGE_FLOOR, bpmMax: BPM_RANGE_CEIL })
    expect(normalizeBpmRange(BPM_RANGE_CEIL, BPM_RANGE_CEIL, 'min')).toEqual({
      bpmMin: BPM_RANGE_CEIL - MIN_BPM_SPAN,
      bpmMax: BPM_RANGE_CEIL,
    })
    expect(normalizeBpmRange(0, 0, 'max')).toEqual({ bpmMin: BPM_RANGE_FLOOR, bpmMax: BPM_RANGE_FLOOR + MIN_BPM_SPAN })
  })

  it('rejects non-finite input', () => {
    expect(normalizeBpmRange(Number.NaN, 200)).toBeNull()
  })
})

describe('modelReducer setBpmRange', () => {
  const state = createTimelineState([{ id: 'a', name: 'A', bpms: [10, 500], sourceOffset: 0 }], { bpmMin: 60, bpmMax: 200 })

  it('sets the range and leaves the points alone', () => {
    const next = modelReducer(state, { type: 'setBpmRange', bpmMin: 80, bpmMax: 160 })
    expect(next).toMatchObject({ bpmMin: 80, bpmMax: 160 })
    expect(next.tracks).toBe(state.tracks)
  })

  it('returns the same state for a no-op or invalid range', () => {
    expect(modelReducer(state, { type: 'setBpmRange', bpmMin: 60, bpmMax: 200 })).toBe(state)
    expect(modelReducer(state, { type: 'setBpmRange', bpmMin: Number.NaN, bpmMax: 200 })).toBe(state)
  })
})
