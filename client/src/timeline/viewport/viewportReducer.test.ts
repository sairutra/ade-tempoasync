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
