import { describe, expect, it } from 'vitest'
import { stepToTime } from '../model/tempo'
import {
  GRID_MIN_MINOR_SPACING_PX,
  MIN_MAJOR_SPACING_PX,
  RULER_MIN_MINOR_SPACING_PX,
  formatStep,
  pickTickScale,
  pxPerStep,
  tickCandidate,
  tickLevel,
  visibleTicks,
} from './ticks'

const BAR = 16
const BEAT = 4

describe('tickCandidate', () => {
  it('runs 16th, beat, bar, then doubling bars', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(tickCandidate)).toEqual([1, 4, 16, 32, 64, 128, 256])
  })
})

describe('pickTickScale', () => {
  // At 120 BPM one 16th is 0.125s, so pxPerStep = pxPerSecond / 8.
  const at120 = (pps: number) => pickTickScale(pxPerStep(pps, 120), RULER_MIN_MINOR_SPACING_PX)

  it('picks 16ths when even a single step fits a label', () => {
    expect(at120(2000)).toEqual({ major: 1, minor: null }) // 250px per 16th
    expect(at120(480)).toEqual({ major: 1, minor: null }) // exactly 60px
  })

  it('picks beats with 16ths as minor ticks', () => {
    expect(at120(400)).toEqual({ major: BEAT, minor: 1 }) // 16th = 50px, beat = 200px
  })

  it('picks bars with beats as minor ticks', () => {
    expect(at120(100)).toEqual({ major: BAR, minor: BEAT }) // beat = 50px, bar = 200px
  })

  it('picks multiples of bars when zoomed out', () => {
    expect(at120(20)).toEqual({ major: 2 * BAR, minor: BAR }) // bar = 40px
    expect(at120(2)).toEqual({ major: 16 * BAR, minor: 8 * BAR }) // bar = 4px
  })

  it('drops the minor interval when it is too dense for the threshold', () => {
    // 16px per step: beat (64px) is major, 16ths (16px) are fine for the ruler but not for 20px.
    expect(pickTickScale(16, RULER_MIN_MINOR_SPACING_PX)).toEqual({ major: BEAT, minor: 1 })
    expect(pickTickScale(16, 20)).toEqual({ major: BEAT, minor: null })
  })

  it('keeps labels apart and picks the finest such candidate at every zoom and tempo', () => {
    for (const bpm of [60, 120, 174, 300]) {
      for (let pps = 2; pps <= 2000; pps *= 1.17) {
        const px = pxPerStep(pps, bpm)
        const { major, minor } = pickTickScale(px, GRID_MIN_MINOR_SPACING_PX)
        expect(major * px).toBeGreaterThanOrEqual(MIN_MAJOR_SPACING_PX)
        if (major > 1) expect(minor === null || minor < major).toBe(true)
        // The next finer candidate must not have fit a label.
        const finer = major === 1 ? null : major === BEAT ? 1 : major === BAR ? BEAT : major / 2
        if (finer !== null) expect(finer * px).toBeLessThan(MIN_MAJOR_SPACING_PX)
        if (minor !== null) expect(minor * px).toBeGreaterThanOrEqual(GRID_MIN_MINOR_SPACING_PX)
      }
    }
  })

  it('falls back to bars for a degenerate scale', () => {
    expect(pickTickScale(0, 5).major).toBe(BAR)
  })
})

describe('tickLevel', () => {
  it('ranks bar > beat > 16th', () => {
    expect(tickLevel(0)).toBe('bar')
    expect(tickLevel(32)).toBe('bar')
    expect(tickLevel(36)).toBe('beat')
    expect(tickLevel(37)).toBe('step')
  })
})

describe('visibleTicks', () => {
  const bpm = 120 // 12.5px per 16th at 100px/s

  it('covers the view on the step lattice and flags major ticks', () => {
    const ticks = visibleTicks({ pxPerSecond: 100, scrollX: 50 }, 300, { major: BAR, minor: BEAT }, bpm)
    expect(ticks.map((t) => t.step)).toEqual([4, 8, 12, 16, 20, 24, 28])
    expect(ticks.filter((t) => t.major).map((t) => t.step)).toEqual([16])
    expect(ticks.map((t) => t.level)).toEqual(['beat', 'beat', 'beat', 'bar', 'beat', 'beat', 'beat'])
    expect(ticks[0].x).toBeCloseTo(0)
    expect(ticks[3].time).toBe(stepToTime(16, bpm))
  })

  it('uses only the major interval when there is no minor', () => {
    const ticks = visibleTicks({ pxPerSecond: 100, scrollX: 0 }, 500, { major: BAR, minor: null }, bpm)
    expect(ticks.map((t) => t.step)).toEqual([0, 16, 32, 48]) // 500px = 40 steps; the last tick may sit just past the edge
    expect(ticks.every((t) => t.major)).toBe(true)
  })

  it('never emits negative steps', () => {
    const ticks = visibleTicks({ pxPerSecond: 100, scrollX: 0 }, 100, { major: BAR, minor: BEAT }, bpm)
    expect(ticks[0].step).toBe(0)
  })

  it('places grid lines exactly on ruler ticks at every zoom', () => {
    for (let pps = 2; pps <= 2000; pps *= 1.5) {
      const v = { pxPerSecond: pps, scrollX: 37 }
      const px = pxPerStep(pps, bpm)
      const ruler = visibleTicks(v, 800, pickTickScale(px, RULER_MIN_MINOR_SPACING_PX), bpm)
      const grid = visibleTicks(v, 800, pickTickScale(px, GRID_MIN_MINOR_SPACING_PX), bpm)
      const rulerX = new Map(ruler.map((t) => [t.step, t.x]))
      for (const t of grid) expect(rulerX.get(t.step)).toBe(t.x)
    }
  })
})

describe('formatStep', () => {
  it('labels bars when bars are the major unit', () => {
    expect(formatStep(0, BAR)).toBe('1')
    expect(formatStep(64, BAR)).toBe('5')
    expect(formatStep(64, 4 * BAR)).toBe('5')
  })

  it('labels bar.beat when beats are the major unit', () => {
    expect(formatStep(64, BEAT)).toBe('5.1')
    expect(formatStep(68, BEAT)).toBe('5.2')
  })

  it('labels bar.beat.16th when 16ths are the major unit', () => {
    expect(formatStep(70, 1)).toBe('5.2.3')
    expect(formatStep(0, 1)).toBe('1.1.1')
    expect(formatStep(15, 1)).toBe('1.4.4')
  })
})
