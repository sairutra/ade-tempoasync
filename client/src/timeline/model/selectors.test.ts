import { describe, expect, it } from 'vitest'
import { createTimelineState, getOrderedTracks, getTimelineDuration, END_PADDING_SECONDS } from './selectors'
import type { Track } from './types'

const t = (id: string, name: string, start: number, duration = 1, y = 0.5): Track => ({
  id,
  name,
  start,
  duration,
  sourceOffset: 0,
  y,
})

describe('getOrderedTracks', () => {
  it('orders by start time', () => {
    const state = createTimelineState([t('a', 'Z', 10), t('b', 'Y', 0), t('c', 'X', 5)])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks start ties alphabetically by name', () => {
    const state = createTimelineState([t('v', 'Vocals', 16), t('g', 'Guitar', 16), t('d', 'Drums', 0)])
    expect(getOrderedTracks(state).map((x) => x.name)).toEqual(['Drums', 'Guitar', 'Vocals'])
  })

  it('falls back to id when start and name are equal', () => {
    const state = createTimelineState([t('b', 'Same', 3), t('a', 'Same', 3)])
    expect(getOrderedTracks(state).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not depend on input order', () => {
    const tracks = [t('a', 'Bass', 8), t('b', 'Keys', 8), t('c', 'Drums', 0)]
    const forward = getOrderedTracks(createTimelineState(tracks)).map((x) => x.id)
    const reversed = getOrderedTracks(createTimelineState([...tracks].reverse())).map((x) => x.id)
    expect(forward).toEqual(reversed)
  })
})

describe('createTimelineState', () => {
  it('clamps y into [0, 1]', () => {
    const state = createTimelineState([t('a', 'A', 0, 1, -2), t('b', 'B', 0, 1, 3)])
    expect(state.tracks.a.y).toBe(0)
    expect(state.tracks.b.y).toBe(1)
  })

  it('rejects duplicate ids', () => {
    expect(() => createTimelineState([t('a', 'A', 0), t('a', 'B', 1)])).toThrow()
  })
})

describe('getTimelineDuration', () => {
  it('is the furthest line end plus padding', () => {
    const state = createTimelineState([t('a', 'A', 0, 10), t('b', 'B', 5, 20)])
    expect(getTimelineDuration(state)).toBe(25 + END_PADDING_SECONDS)
  })
})
