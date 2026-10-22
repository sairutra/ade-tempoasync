import { describe, expect, it } from 'vitest'
import { getOrderedTracks } from '../model/selectors'
import { mockTimeline } from './mockTimeline'

describe('mockTimeline', () => {
  it('orders the headers by name', () => {
    expect(getOrderedTracks(mockTimeline).map((t) => t.name)).toEqual(['Bass', 'Drums', 'Guitar', 'Keys', 'Vocals'])
  })

  it('keeps each part entering at its bar, holding the first BPM before it', () => {
    const { keys, vox } = mockTimeline.tracks
    expect(new Set(keys.bpms.slice(0, 4 * 16))).toEqual(new Set([90]))
    expect(new Set(vox.bpms.slice(0, 8 * 16 + 1))).toEqual(new Set([80]))
  })

  it('has curves, not flat lines, and one that leaves the drawable range', () => {
    for (const t of Object.values(mockTimeline.tracks)) expect(new Set(t.bpms).size).toBeGreaterThan(1)
    const all = Object.values(mockTimeline.tracks).flatMap((t) => t.bpms)
    expect(Math.max(...all)).toBeGreaterThan(mockTimeline.bpmMax)
  })
})
