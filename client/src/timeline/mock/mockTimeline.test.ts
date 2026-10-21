import { describe, expect, it } from 'vitest'
import { getOrderedTracks } from '../model/selectors'
import { mockTimeline } from './mockTimeline'

describe('mockTimeline', () => {
  it('has exactly one start-step tie, resolved by name', () => {
    const tracks = getOrderedTracks(mockTimeline)
    expect(tracks.map((t) => t.name)).toEqual(['Drums', 'Bass', 'Keys', 'Vocals', 'Guitar'])
    const starts = tracks.map((t) => t.startStep)
    expect(starts.length - new Set(starts).size).toBe(1)
  })

  it('has curves, not flat lines, and one that leaves the drawable range', () => {
    for (const t of Object.values(mockTimeline.tracks)) expect(new Set(t.bpms).size).toBeGreaterThan(1)
    const all = Object.values(mockTimeline.tracks).flatMap((t) => t.bpms)
    expect(Math.max(...all)).toBeGreaterThan(mockTimeline.bpmMax)
  })
})
