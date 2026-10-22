import { describe, expect, it } from 'vitest'
import { alignedBpms, alignmentRatios, formatAlignment } from './alignment'

const bpms = (projectBpm: number, min = 1, max = 1000) => alignedBpms(projectBpm, min, max).map((a) => a.bpm)

describe('alignmentRatios', () => {
  it('lists every reduced ratio with both sides within one bar, ascending', () => {
    const r = alignmentRatios().map((x) => `${x.trackBeats}:${x.projectBeats}`)
    expect(r).toEqual(['1:4', '1:3', '1:2', '2:3', '3:4', '1:1', '4:3', '3:2', '2:1', '3:1', '4:1'])
  })
})

describe('alignedBpms', () => {
  it('matches the examples: 90 → 45, 120, 180; 100 → 25', () => {
    expect(bpms(90)).toEqual(expect.arrayContaining([45, 90, 120, 180]))
    expect(bpms(100)).toContain(25)
  })

  it('gives the full set for 90 BPM', () => {
    expect(bpms(90)).toEqual([22.5, 30, 45, 60, 67.5, 90, 120, 135, 180, 270, 360])
  })

  it('keeps only BPMs inside the range (inclusive)', () => {
    expect(bpms(90, 45, 180)).toEqual([45, 60, 67.5, 90, 120, 135, 180])
  })

  it('classifies unison, power-of-two and other ratios', () => {
    const kinds = Object.fromEntries(alignedBpms(100, 0, 1000).map((a) => [a.bpm, a.kind]))
    expect(kinds[100]).toBe('unison')
    expect(kinds[50]).toBe('power')
    expect(kinds[25]).toBe('power')
    expect(kinds[400]).toBe('power')
    expect(kinds[75]).toBe('other')
  })

  it('returns nothing for a non-positive tempo', () => {
    expect(alignedBpms(0, 0, 1000)).toEqual([])
  })
})

describe('formatAlignment', () => {
  it('shows track:project beats and the BPM', () => {
    const a = alignedBpms(90, 100, 130)[0]
    expect(formatAlignment(a)).toBe('4:3 · 120')
    expect(formatAlignment(alignedBpms(100, 33, 34)[0])).toBe('1:3 · 33.33')
  })
})
