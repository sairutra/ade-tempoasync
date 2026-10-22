import { describe, expect, it } from 'vitest'
import { modelReducer } from './editReducer'
import { buildNewTrack, NEW_TRACK_MIN_STEPS, suggestChannel } from './newTrack'
import { createTimelineState } from './selectors'
import { DEFAULT_SEQUENCE, MIDDLE_C, REST } from './sequence'
import { STEPS_PER_BAR } from './tempo'
import type { TrackInput } from './types'

const sequence = [...DEFAULT_SEQUENCE]

const t = (id: string, length: number, color?: string): TrackInput => ({
  id, name: id, bpms: Array(length).fill(120), sourceOffset: 0, color,
})

describe('buildNewTrack', () => {
  it('builds a flat line with nodes at both ends', () => {
    expect(NEW_TRACK_MIN_STEPS).toBe(32 * STEPS_PER_BAR)
    const track = buildNewTrack(createTimelineState([]), { name: ' Synth ', color: '#3d85c6', bpm: 95, channel: 1, sequence })
    expect(track).toMatchObject({ id: 'synth', name: 'Synth', color: '#3d85c6', sourceOffset: 0, channel: 1, sequence })
    expect(track.bpms).toHaveLength(NEW_TRACK_MIN_STEPS)
    expect(new Set(track.bpms)).toEqual(new Set([95]))
    expect(track.nodes).toEqual([0, NEW_TRACK_MIN_STEPS - 1])
  })

  it('spans from step 0 to the current content end', () => {
    const state = createTimelineState([t('a', NEW_TRACK_MIN_STEPS + 200)])
    const track = buildNewTrack(state, { name: 'B', color: '#000000', bpm: 120, channel: 1, sequence })
    expect(track.bpms).toHaveLength(NEW_TRACK_MIN_STEPS + 200)
    expect(track.nodes).toEqual([0, NEW_TRACK_MIN_STEPS + 199])
  })

  it('makes ids unique', () => {
    const state = createTimelineState([t('synth', 4), t('synth-2', 4)])
    expect(buildNewTrack(state, { name: 'Synth', color: '#000000', bpm: 120, channel: 1, sequence }).id).toBe('synth-3')
  })

  it('adjusts a colour already used by another track', () => {
    const state = createTimelineState([t('a', 4, '#E07A5F')])
    expect(buildNewTrack(state, { name: 'B', color: '#e07a5f', bpm: 120, channel: 1, sequence }).color).not.toBe('#e07a5f')
  })

  it('rejects an empty name and a non-positive BPM', () => {
    const state = createTimelineState([])
    expect(() => buildNewTrack(state, { name: '  ', color: '#000000', bpm: 120, channel: 1, sequence })).toThrow()
    expect(() => buildNewTrack(state, { name: 'X', color: '#000000', bpm: 0, channel: 1, sequence })).toThrow()
  })
})

describe('channel number', () => {
  it('keeps the given channel and rejects anything but an integer in 1–16', () => {
    const state = createTimelineState([])
    const input = { name: 'X', color: '#000000', bpm: 120, sequence }
    expect(buildNewTrack(state, { ...input, channel: 16, sequence }).channel).toBe(16)
    for (const channel of [0, 17, 1.5, NaN, -1]) {
      expect(() => buildNewTrack(state, { ...input, channel })).toThrow()
    }
  })

  it('suggests the lowest unused channel, or 1 when all 16 are taken', () => {
    expect(suggestChannel(createTimelineState([]))).toBe(1)
    const some = createTimelineState([{ ...t('a', 4), channel: 1, sequence }, { ...t('b', 4), channel: 3 }])
    expect(suggestChannel(some)).toBe(2)
    const all = createTimelineState(Array.from({ length: 16 }, (_, i) => ({ ...t(`c${i}`, 4), channel: i + 1 })))
    expect(suggestChannel(all)).toBe(1)
  })
})

describe('modelReducer addTrack', () => {
  it('adds the track without touching the others', () => {
    const state = createTimelineState([t('a', 4, '#e07a5f')])
    const next = modelReducer(state, { type: 'addTrack', track: { name: 'New', color: '#e07a5f', bpm: 100, channel: 1, sequence } })
    expect(Object.keys(next.tracks)).toEqual(['a', 'new'])
    expect(next.tracks.a).toBe(state.tracks.a)
    expect(next.tracks.new.color).not.toBe('#e07a5f')
  })
})

describe('MIDI sequence', () => {
  it('defaults to middle C on every downbeat of 16 steps', () => {
    expect(DEFAULT_SEQUENCE).toHaveLength(16)
    expect(DEFAULT_SEQUENCE.flatMap((n, i) => (n === MIDDLE_C ? [i] : []))).toEqual([0, 4, 8, 12])
    expect(DEFAULT_SEQUENCE.filter((n) => n !== MIDDLE_C).every((n) => n === REST)).toBe(true)
  })

  it('is copied onto the new track', () => {
    const input = { name: 'X', color: '#000000', bpm: 120, channel: 1, sequence: [60, -1, 127, 0] }
    const track = buildNewTrack(createTimelineState([]), input)
    expect(track.sequence).toEqual([60, -1, 127, 0])
    expect(track.sequence).not.toBe(input.sequence)
  })

  it('rejects empty, too long, out-of-range or non-integer sequences', () => {
    const state = createTimelineState([])
    const input = { name: 'X', color: '#000000', bpm: 120, channel: 1 }
    for (const bad of [[], Array(17).fill(60), [128], [-2], [60.5], [NaN]]) {
      expect(() => buildNewTrack(state, { ...input, sequence: bad })).toThrow()
    }
  })
})

describe('modelReducer editTrack', () => {
  const base = () => createTimelineState([{ ...t('a', 4), sequence: [...DEFAULT_SEQUENCE] }, t('b', 4)])

  it('replaces the sequence of that track only', () => {
    const state = base()
    const next = modelReducer(state, { type: 'editTrack', trackId: 'a', changes: { sequence: [62, -1] } })
    expect(next.tracks.a.sequence).toEqual([62, -1])
    expect(next.tracks.b).toBe(state.tracks.b)
  })

  it('gives a track loaded without a sequence one', () => {
    const next = modelReducer(base(), { type: 'editTrack', trackId: 'b', changes: { sequence: [60] } })
    expect(next.tracks.b.sequence).toEqual([60])
  })

  it('returns the same state for an unchanged, invalid or unknown edit', () => {
    const state = base()
    for (const action of [
      { trackId: 'a', changes: { sequence: [...DEFAULT_SEQUENCE] } },
      { trackId: 'a', changes: { sequence: [200] } },
      { trackId: 'a', changes: {} },
      { trackId: 'nope', changes: { sequence: [60] } },
    ]) {
      expect(modelReducer(state, { type: 'editTrack', ...action })).toBe(state)
    }
  })
})
