import { describe, expect, it } from 'vitest'
import { MIN_MAJOR_SPACING_PX, formatTime, pickTickScale, visibleTicks } from './ticks'

describe('pickTickScale', () => {
  it('picks the smallest interval that keeps labels apart', () => {
    expect(pickTickScale(1000).major).toBe(0.1) // 100px apart
    expect(pickTickScale(100).major).toBe(1) // 0.5s would be 50px
    expect(pickTickScale(13).major).toBe(10) // 5s would be 65px
    expect(pickTickScale(2).major).toBe(60)
  })

  it('always leaves at least the minimum spacing between labels', () => {
    for (let pps = 2; pps <= 2000; pps *= 1.3) {
      expect(pickTickScale(pps).major * pps).toBeGreaterThanOrEqual(MIN_MAJOR_SPACING_PX)
    }
  })
})

describe('visibleTicks', () => {
  it('covers the view and flags major ticks', () => {
    const ticks = visibleTicks({ pxPerSecond: 100, scrollX: 50 }, 300, { major: 1, minor: 0.2 })
    expect(ticks[0].time).toBeCloseTo(0.4)
    expect(ticks.at(-1)!.time).toBeCloseTo(3.6)
    expect(ticks.filter((t) => t.major).map((t) => t.time)).toEqual([1, 2, 3])
  })

  it('never emits negative times', () => {
    const ticks = visibleTicks({ pxPerSecond: 100, scrollX: 0 }, 100, { major: 1, minor: 0.2 })
    expect(ticks[0].time).toBe(0)
  })
})

describe('formatTime', () => {
  it('formats as m:ss', () => {
    expect(formatTime(0, 5)).toBe('0:00')
    expect(formatTime(65, 5)).toBe('1:05')
    expect(formatTime(1.5, 0.5)).toBe('0:01.5')
  })

  it('absorbs float error from index * interval', () => {
    expect(formatTime(3000 * 0.02, 0.1)).toBe('1:00.0')
    expect(formatTime(7 * 0.1, 0.1)).toBe('0:00.7')
  })
})
