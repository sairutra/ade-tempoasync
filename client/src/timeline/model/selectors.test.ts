import { describe, expect, it } from 'vitest'
import {
  bpmToFraction,
  clampBpm,
  createTimelineState,
  END_PADDING_SECONDS,
  getContentEndStep,
  getOrderedTracks,
  getTimelineDuration,
  trackLastStep,
} from './selectors'
import type { Track } from './types'

const t = (id: string, name: string, startStep: number, bpms: number[] = [120]): Track => ({
  id,
  name,
  startStep,
  bpms,
  sourceOffset: 0,
})

describe('getOrderedTracks', () => {
  it('orders by start step', () => {
    const state = createTimelineState([t('a', 'Z', 160), t('b', 'Y', 0), t('c', 'X', 80)])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('ignores line length and BPM when ordering', () => {
    const state = createTimelineState([t('long', 'A', 8, [200, 60, 90, 90, 90]), t('short', 'B', 4, [61])])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['short', 'long'])
  })

  it('breaks start-step ties alphabetically by name', () => {
    const state = createTimelineState([t('v', 'Vocals', 16), t('g', 'Guitar', 16), t('d', 'Drums', 0)])
    expect(getOrderedTracks(state).map((x) => x.name)).toEqual(['Drums', 'Guitar', 'Vocals'])
  })

  it('falls back to id when start step and name are equal', () => {
    const state = createTimelineState([t('b', 'Same', 3), t('a', 'Same', 3)])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not depend on input order', () => {
    const tracks = [t('a', 'Bass', 64), t('b', 'Keys', 64), t('c', 'Drums', 0)]
    const forward = getOrderedTracks(createTimelineState(tracks)).map((x) => x.id)
    const reversed = getOrderedTracks(createTimelineState([...tracks].reverse())).map((x) => x.id)
    expect(forward).toEqual(reversed)
  })
})

describe('createTimelineState', () => {
  it('keeps out-of-range BPMs unclamped in the model', () => {
    const state = createTimelineState([t('a', 'A', 0, [10, 500])], { bpmMin: 60, bpmMax: 200 })
    expect(state.tracks.a.bpms).toEqual([10, 500])
  })

  it('stores the BPM range and project tempo', () => {
    const state = createTimelineState([], { projectBpm: 90, bpmMin: 70, bpmMax: 180 })
    expect(state).toMatchObject({ projectBpm: 90, bpmMin: 70, bpmMax: 180 })
  })

  it('rejects an invalid BPM range', () => {
    expect(() => createTimelineState([], { bpmMin: 120, bpmMax: 120 })).toThrow()
    expect(() => createTimelineState([], { bpmMin: 200, bpmMax: 60 })).toThrow()
  })

  it('rejects malformed tracks', () => {
    expect(() => createTimelineState([t('a', 'A', 0), t('a', 'B', 1)])).toThrow() // duplicate id
    expect(() => createTimelineState([t('a', 'A', 0, [])])).toThrow() // no points
    expect(() => createTimelineState([t('a', 'A', 1.5)])).toThrow() // fractional step
    expect(() => createTimelineState([t('a', 'A', -1)])).toThrow()
    expect(() => createTimelineState([t('a', 'A', 0, [120, NaN])])).toThrow()
  })
})

describe('trackLastStep / getContentEndStep', () => {
  it('last point is startStep + bpms.length - 1', () => {
    expect(trackLastStep(t('a', 'A', 10, [120]))).toBe(10)
    expect(trackLastStep(t('a', 'A', 10, [120, 130, 140]))).toBe(12)
  })

  it('is the furthest last point over all tracks, not the latest start', () => {
    const state = createTimelineState([t('a', 'A', 0, Array(100).fill(120)), t('b', 'B', 50, [120, 120])])
    expect(getContentEndStep(state)).toBe(99)
  })

  it('is 0 for an empty timeline', () => {
    expect(getContentEndStep(createTimelineState([]))).toBe(0)
  })
})

describe('getTimelineDuration', () => {
  it('is stepToTime(furthest last point) plus padding', () => {
    // Last point at step 32 → 4 s at 120 BPM (0.125 s per 16th).
    const state = createTimelineState([t('a', 'A', 0, Array(17).fill(100)), t('b', 'B', 30, [1, 2, 3])])
    expect(getTimelineDuration(state)).toBe(4 + END_PADDING_SECONDS)
  })

  it('uses the project tempo, not the track BPMs', () => {
    const state = createTimelineState([t('a', 'A', 16, [200])], { projectBpm: 60 })
    expect(getTimelineDuration(state)).toBe(4 + END_PADDING_SECONDS) // 16 sixteenths at 60 BPM
  })

  it('is just the padding for an empty timeline', () => {
    expect(getTimelineDuration(createTimelineState([]))).toBe(END_PADDING_SECONDS)
  })
})

describe('clampBpm / bpmToFraction', () => {
  it('clamps into [bpmMin, bpmMax]', () => {
    expect(clampBpm(30, 60, 200)).toBe(60)
    expect(clampBpm(250, 60, 200)).toBe(200)
    expect(clampBpm(120, 60, 200)).toBe(120)
  })

  it('maps higher BPM higher (smaller fraction), clamped to [0, 1]', () => {
    expect(bpmToFraction(200, 60, 200)).toBe(0)
    expect(bpmToFraction(60, 60, 200)).toBe(1)
    expect(bpmToFraction(130, 60, 200)).toBe(0.5)
    expect(bpmToFraction(999, 60, 200)).toBe(0)
    expect(bpmToFraction(-5, 60, 200)).toBe(1)
  })
})
