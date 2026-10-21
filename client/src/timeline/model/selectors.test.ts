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
import type { TrackInput } from './types'

const t = (id: string, name: string, bpms: number[] = [120]): TrackInput => ({
  id,
  name,
  bpms,
  sourceOffset: 0,
})

describe('getOrderedTracks', () => {
  it('orders alphabetically by name', () => {
    const state = createTimelineState([t('v', 'Vocals'), t('g', 'Guitar'), t('d', 'Drums')])
    expect(getOrderedTracks(state).map((x) => x.name)).toEqual(['Drums', 'Guitar', 'Vocals'])
  })

  it('ignores line length and BPM when ordering', () => {
    const state = createTimelineState([t('long', 'B', [200, 60, 90, 90, 90]), t('short', 'A', [61])])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['short', 'long'])
  })

  it('falls back to id when names are equal', () => {
    const state = createTimelineState([t('b', 'Same'), t('a', 'Same')])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not depend on input order', () => {
    const tracks = [t('a', 'Bass'), t('b', 'Keys'), t('c', 'Drums')]
    const forward = getOrderedTracks(createTimelineState(tracks)).map((x) => x.id)
    const reversed = getOrderedTracks(createTimelineState([...tracks].reverse())).map((x) => x.id)
    expect(forward).toEqual(reversed)
  })
})

describe('createTimelineState', () => {
  it('keeps out-of-range BPMs unclamped in the model', () => {
    const state = createTimelineState([t('a', 'A', [10, 500])], { bpmMin: 60, bpmMax: 200 })
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
    expect(() => createTimelineState([t('a', 'A'), t('a', 'B')])).toThrow() // duplicate id
    expect(() => createTimelineState([t('a', 'A', [])])).toThrow() // no points
    expect(() => createTimelineState([t('a', 'A', [120, NaN])])).toThrow()
  })
})

describe('trackLastStep / getContentEndStep', () => {
  it('last point is bpms.length - 1 (every line starts at step 0)', () => {
    expect(trackLastStep(t('a', 'A', [120]))).toBe(0)
    expect(trackLastStep(t('a', 'A', [120, 130, 140]))).toBe(2)
  })

  it('is the furthest last point over all tracks', () => {
    const state = createTimelineState([t('a', 'A', Array(100).fill(120)), t('b', 'B', [120, 120])])
    expect(getContentEndStep(state)).toBe(99)
  })

  it('is 0 for an empty timeline', () => {
    expect(getContentEndStep(createTimelineState([]))).toBe(0)
  })
})

describe('getTimelineDuration', () => {
  it('is stepToTime(furthest last point) plus padding', () => {
    // Last point at step 32 → 4 s at 120 BPM (0.125 s per 16th).
    const state = createTimelineState([t('a', 'A', Array(33).fill(100)), t('b', 'B', [1, 2, 3])])
    expect(getTimelineDuration(state)).toBe(4 + END_PADDING_SECONDS)
  })

  it('uses the project tempo, not the track BPMs', () => {
    const state = createTimelineState([t('a', 'A', Array(17).fill(200))], { projectBpm: 60 })
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
