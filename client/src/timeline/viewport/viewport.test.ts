import { describe, expect, it } from 'vitest'
import {
  MAX_PX_PER_SECOND,
  MIN_PX_PER_SECOND,
  clampViewport,
  maxScrollX,
  scrollBy,
  timeToX,
  visibleTimeRange,
  xToTime,
  zoomAt,
  zoomToFit,
  type Viewport,
} from './viewport'

const bounds = { viewWidth: 800, duration: 60 }

describe('timeToX / xToTime', () => {
  it('applies zoom and scroll', () => {
    const v: Viewport = { pxPerSecond: 100, scrollX: 250 }
    expect(timeToX(0, v)).toBe(-250)
    expect(timeToX(5, v)).toBe(250)
    expect(xToTime(250, v)).toBe(5)
  })

  it('are inverses', () => {
    const v: Viewport = { pxPerSecond: 37.5, scrollX: 123.4 }
    for (const t of [0, 0.1, 3.3, 59.99]) expect(xToTime(timeToX(t, v), v)).toBeCloseTo(t, 9)
    for (const x of [-50, 0, 400, 799]) expect(timeToX(xToTime(x, v), v)).toBeCloseTo(x, 9)
  })
})

describe('clampViewport', () => {
  it('clamps zoom to [MIN, MAX]', () => {
    expect(clampViewport({ pxPerSecond: 0.01, scrollX: 0 }, bounds).pxPerSecond).toBe(MIN_PX_PER_SECOND)
    expect(clampViewport({ pxPerSecond: 1e6, scrollX: 0 }, bounds).pxPerSecond).toBe(MAX_PX_PER_SECOND)
  })

  it('clamps scroll to [0, contentWidth - viewWidth]', () => {
    expect(clampViewport({ pxPerSecond: 100, scrollX: -10 }, bounds).scrollX).toBe(0)
    expect(clampViewport({ pxPerSecond: 100, scrollX: 1e9 }, bounds).scrollX).toBe(6000 - 800)
  })

  it('pins scroll to 0 when content is narrower than the view', () => {
    expect(maxScrollX(5, bounds)).toBe(0)
    expect(clampViewport({ pxPerSecond: 5, scrollX: 40 }, bounds).scrollX).toBe(0)
  })

  it('returns the same object when already valid', () => {
    const v = { pxPerSecond: 100, scrollX: 10 }
    expect(clampViewport(v, bounds)).toBe(v)
  })
})

describe('scrollBy', () => {
  it('moves and clamps', () => {
    const v = { pxPerSecond: 100, scrollX: 100 }
    expect(scrollBy(v, 50, bounds).scrollX).toBe(150)
    expect(scrollBy(v, -500, bounds).scrollX).toBe(0)
  })
})

describe('zoomAt (zoom around cursor)', () => {
  it('keeps the time under the cursor fixed', () => {
    const v = { pxPerSecond: 100, scrollX: 500 }
    const anchorX = 300
    const before = xToTime(anchorX, v)
    for (const factor of [2, 0.5, 1.37]) {
      const next = zoomAt(v, factor, anchorX, bounds)
      expect(next.pxPerSecond).toBeCloseTo(100 * factor)
      expect(xToTime(anchorX, next)).toBeCloseTo(before, 9)
    }
  })

  it('computes the expected scroll', () => {
    // time under x=300 is (300+500)/100 = 8s; at 200 px/s, 8s sits at 1600px, so scrollX = 1300
    expect(zoomAt({ pxPerSecond: 100, scrollX: 500 }, 2, 300, bounds)).toEqual({ pxPerSecond: 200, scrollX: 1300 })
  })

  it('keeps the anchor after the zoom is clamped at MAX', () => {
    const v = { pxPerSecond: 1500, scrollX: 30000 }
    const next = zoomAt(v, 10, 400, bounds)
    expect(next.pxPerSecond).toBe(MAX_PX_PER_SECOND)
    expect(xToTime(400, next)).toBeCloseTo(xToTime(400, v), 9)
  })

  it('lets scroll clamping win at the edges', () => {
    // anchored near time 0, zooming out cannot scroll before the start
    const next = zoomAt({ pxPerSecond: 100, scrollX: 0 }, 0.5, 400, bounds)
    expect(next.scrollX).toBe(0)
  })
})

describe('zoomToFit', () => {
  it('fits the whole duration in the view', () => {
    expect(zoomToFit(bounds)).toEqual({ pxPerSecond: 800 / 60, scrollX: 0 })
  })

  it('handles an unmeasured view', () => {
    expect(zoomToFit({ viewWidth: 0, duration: 60 }).pxPerSecond).toBe(MIN_PX_PER_SECOND)
  })
})

describe('visibleTimeRange', () => {
  it('maps the view edges to times, with overscan', () => {
    const v = { pxPerSecond: 100, scrollX: 1000 }
    expect(visibleTimeRange(v, 800)).toEqual([10, 18])
    expect(visibleTimeRange(v, 800, 100)).toEqual([9, 19])
  })
})
