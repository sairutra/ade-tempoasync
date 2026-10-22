import { describe, expect, it } from 'vitest'
import { isOnProjectBar, lineBeats, lineStepAt, lineTimeAt, lineTiming } from './syncView'

const flat = (bpm: number, steps: number) => new Array<number>(steps).fill(bpm)

describe('lineTiming', () => {
  it('maps steps to real time and back, holding the last BPM past the end', () => {
    const t = lineTiming(flat(90, 17))
    expect(lineTimeAt(t, 16)).toBeCloseTo(8 / 3, 9)
    expect(lineTimeAt(t, 48)).toBeCloseTo(8, 9) // past the last point, still 90 BPM
    expect(lineStepAt(t, 8)).toBeCloseTo(48, 9)
  })
})

describe('isOnProjectBar', () => {
  it('accepts times within the tolerance of a bar line', () => {
    expect(isOnProjectBar(0, 120)).toBe(true)
    expect(isOnProjectBar(4.011, 120)).toBe(true)
    expect(isOnProjectBar(3.987, 120)).toBe(false)
    expect(isOnProjectBar(2.667, 120)).toBe(false)
  })
})

describe('lineBeats', () => {
  it('is in sync on every bar for a line at the project tempo', () => {
    const beats = lineBeats(lineTiming(flat(120, 1)), 8, 120)
    const bars = beats.filter((b) => b.level === 'bar')
    expect(bars.map((b) => b.time)).toEqual([0, 2, 4, 6, 8])
    expect(bars.every((b) => b.inSync)).toBe(true)
    expect(beats.filter((b) => b.level === 'beat')).toHaveLength(12)
  })

  it('lights up every 3 line bars (= every 4 project bars) for 90 against 120', () => {
    const bars = lineBeats(lineTiming(flat(90, 1)), 24.1, 120, false)
    expect(bars.map((b) => b.step / 16)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(bars.filter((b) => b.inSync).map((b) => Math.round(b.time / 2))).toEqual([0, 4, 8, 12])
  })
})
