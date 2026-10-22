import { describe, expect, it } from 'vitest'
import { buildTrackPath, trackViewBox } from './trackPath'

// Range 60–200: y = 200 - bpm, viewBox height 140.
describe('buildTrackPath', () => {
  it('moves to the first point, lines through each step, then holds to the content end', () => {
    expect(buildTrackPath([120, 140, 100], 60, 200, 10)).toBe('M0 80 L1 60 L2 100 H10')
  })

  it('draws a single point as a horizontal line', () => {
    expect(buildTrackPath([130], 60, 200, 5)).toBe('M0 70 H5')
  })

  it('clamps out-of-range BPMs to the edges when drawn', () => {
    expect(buildTrackPath([250, 30, 200, 60], 60, 200, 3)).toBe('M0 0 L1 140 L2 0 L3 140')
  })

  it('omits the tail when the last point is already at the content end', () => {
    expect(buildTrackPath([120, 120], 60, 200, 1)).toBe('M0 80 L1 80')
  })

  it('does not mutate the input', () => {
    const bpms = [500, 10]
    buildTrackPath(bpms, 60, 200, 4)
    expect(bpms).toEqual([500, 10])
  })
})

describe('trackViewBox', () => {
  it('is steps wide and (bpmMax - bpmMin) tall', () => {
    expect(trackViewBox(60, 200, 48)).toBe('0 0 48 140')
  })
})
