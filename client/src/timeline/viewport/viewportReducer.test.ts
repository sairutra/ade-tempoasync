import { describe, expect, it } from 'vitest'
import { initViewportState, viewportReducer } from './viewportReducer'

describe('viewportReducer', () => {
  it('zooms to fit on the first measurement only', () => {
    let s = initViewportState(60)
    s = viewportReducer(s, { type: 'resize', viewWidth: 600 })
    expect(s.viewport).toEqual({ pxPerSecond: 10, scrollX: 0 })

    s = viewportReducer(s, { type: 'zoomAt', factor: 4, anchorX: 0 })
    s = viewportReducer(s, { type: 'resize', viewWidth: 900 })
    expect(s.viewport.pxPerSecond).toBe(40)
  })

  it('returns the same state for no-op actions', () => {
    const s = viewportReducer(initViewportState(60), { type: 'resize', viewWidth: 600 })
    expect(viewportReducer(s, { type: 'scrollBy', dx: -100 })).toBe(s)
    expect(viewportReducer(s, { type: 'resize', viewWidth: 600 })).toBe(s)
  })

  it('re-clamps scroll when the duration shrinks', () => {
    let s = viewportReducer(initViewportState(60), { type: 'resize', viewWidth: 600 })
    s = viewportReducer(s, { type: 'zoomAt', factor: 10, anchorX: 0 })
    s = viewportReducer(s, { type: 'scrollTo', scrollX: 1e9 })
    expect(s.viewport.scrollX).toBe(6000 - 600)
    s = viewportReducer(s, { type: 'setDuration', duration: 30 })
    expect(s.viewport.scrollX).toBe(3000 - 600)
  })
})

describe('viewportReducer (BPM axis)', () => {
  const sized = () => {
    let s = initViewportState(60, { bpmMin: 60, bpmMax: 200 })
    s = viewportReducer(s, { type: 'resize', viewWidth: 600 })
    return viewportReducer(s, { type: 'resizeY', viewHeight: 400 })
  }

  it('starts fitted and only scrolls once stretched', () => {
    let s = sized()
    expect(s.bpmViewport).toEqual({ zoom: 1, scrollY: 0 })
    expect(viewportReducer(s, { type: 'scrollYBy', dy: 100 })).toBe(s)
    s = viewportReducer(s, { type: 'zoomYAt', factor: 3, anchorY: 0 })
    s = viewportReducer(s, { type: 'scrollYBy', dy: 100 })
    expect(s.bpmViewport).toEqual({ zoom: 3, scrollY: 100 })
  })

  it('keeps the zoom when the BPM range changes, and fits on request', () => {
    let s = viewportReducer(sized(), { type: 'zoomYAt', factor: 2, anchorY: 200 })
    s = viewportReducer(s, { type: 'setBpmRange', bpmMin: 40, bpmMax: 300 })
    expect(s.bpmBounds).toMatchObject({ bpmMin: 40, bpmMax: 300 })
    expect(s.bpmViewport.zoom).toBe(2)
    s = viewportReducer(s, { type: 'zoomYToFit' })
    expect(s.bpmViewport).toEqual({ zoom: 1, scrollY: 0 })
    expect(viewportReducer(s, { type: 'zoomYToFit' })).toBe(s)
  })

  it('leaves the horizontal axis alone', () => {
    const s = sized()
    expect(viewportReducer(s, { type: 'zoomYAt', factor: 2, anchorY: 0 }).viewport).toBe(s.viewport)
  })
})
