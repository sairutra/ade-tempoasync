import { describe, expect, it } from 'vitest'
import { modelReducer } from './editReducer'
import { buildNewTrack, NEW_TRACK_MIN_STEPS, suggestChannel } from './newTrack'
import { createTimelineState } from './selectors'
import type { TrackInput } from './types'

const t = (id: string, length: number, color?: string): TrackInput => ({
  id, name: id, bpms: Array(length).fill(120), sourceOffset: 0, color,
})

describe('buildNewTrack', () => {
  it('builds a flat line with nodes at both ends', () => {
    const track = buildNewTrack(createTimelineState([]), { name: ' Synth ', color: '#3d85c6', bpm: 95, channel: 1 })
    expect(track).toMatchObject({ id: 'synth', name: 'Synth', color: '#3d85c6', sourceOffset: 0, channel: 1 })
    expect(track.bpms).toHaveLength(NEW_TRACK_MIN_STEPS)
    expect(new Set(track.bpms)).toEqual(new Set([95]))
    expect(track.nodes).toEqual([0, NEW_TRACK_MIN_STEPS - 1])
  })

  it('spans from step 0 to the current content end', () => {
    const state = createTimelineState([t('a', 200)])
    const track = buildNewTrack(state, { name: 'B', color: '#000000', bpm: 120, channel: 1 })
    expect(track.bpms).toHaveLength(200)
    expect(track.nodes).toEqual([0, 199])
  })

  it('makes ids unique', () => {
    const state = createTimelineState([t('synth', 4), t('synth-2', 4)])
    expect(buildNewTrack(state, { name: 'Synth', color: '#000000', bpm: 120, channel: 1 }).id).toBe('synth-3')
  })

  it('adjusts a colour already used by another track', () => {
    const state = createTimelineState([t('a', 4, '#E07A5F')])
    expect(buildNewTrack(state, { name: 'B', color: '#e07a5f', bpm: 120, channel: 1 }).color).not.toBe('#e07a5f')
  })

  it('rejects an empty name and a non-positive BPM', () => {
    const state = createTimelineState([])
    expect(() => buildNewTrack(state, { name: '  ', color: '#000000', bpm: 120, channel: 1 })).toThrow()
    expect(() => buildNewTrack(state, { name: 'X', color: '#000000', bpm: 0, channel: 1 })).toThrow()
  })
})

describe('channel number', () => {
  it('keeps the given channel and rejects anything but an integer in 1–16', () => {
    const state = createTimelineState([])
    const input = { name: 'X', color: '#000000', bpm: 120 }
    expect(buildNewTrack(state, { ...input, channel: 16 }).channel).toBe(16)
    for (const channel of [0, 17, 1.5, NaN, -1]) {
      expect(() => buildNewTrack(state, { ...input, channel })).toThrow()
    }
  })

  it('suggests the lowest unused channel, or 1 when all 16 are taken', () => {
    expect(suggestChannel(createTimelineState([]))).toBe(1)
    const some = createTimelineState([{ ...t('a', 4), channel: 1 }, { ...t('b', 4), channel: 3 }])
    expect(suggestChannel(some)).toBe(2)
    const all = createTimelineState(Array.from({ length: 16 }, (_, i) => ({ ...t(`c${i}`, 4), channel: i + 1 })))
    expect(suggestChannel(all)).toBe(1)
  })
})

describe('modelReducer addTrack', () => {
  it('adds the track without touching the others', () => {
    const state = createTimelineState([t('a', 4, '#e07a5f')])
    const next = modelReducer(state, { type: 'addTrack', track: { name: 'New', color: '#e07a5f', bpm: 100, channel: 1 } })
    expect(Object.keys(next.tracks)).toEqual(['a', 'new'])
    expect(next.tracks.a).toBe(state.tracks.a)
    expect(next.tracks.new.color).not.toBe('#e07a5f')
  })
})
