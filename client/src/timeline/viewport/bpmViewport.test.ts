import { describe, expect, it } from 'vitest'
import {
  bpmToY,
  clampBpmViewport,
  contentHeight,
  maxScrollY,
  MAX_ZOOM_Y,
  PAD_BOTTOM,
  PAD_TOP,
  pickBpmInterval,
  pxPerBpm,
  rebound,
  scrollYBy,
  visibleBpmTicks,
  yToBpm,
  zoomYAt,
  type BpmBounds,
} from './bpmViewport'

// 140 BPM of range in 280px of lane height: 2 px/BPM at zoom 1.
const b: BpmBounds = { viewHeight: 280 + PAD_TOP + PAD_BOTTOM, bpmMin: 60, bpmMax: 200 }
const fit = { zoom: 1, scrollY: 0 }

describe('bpmViewport', () => {
  it('fits the whole range at zoom 1', () => {
    expect(pxPerBpm(fit, b)).toBe(2)
    expect(bpmToY(200, fit, b)).toBe(PAD_TOP)
    expect(bpmToY(60, fit, b)).toBe(PAD_TOP + 280)
    expect(contentHeight(fit, b)).toBe(b.viewHeight)
    expect(maxScrollY(fit, b)).toBe(0)
  })

  it('yToBpm inverts bpmToY', () => {
    const v = { zoom: 3, scrollY: 123 }
    for (const bpm of [60, 97.5, 200]) expect(yToBpm(bpmToY(bpm, v, b), v, b)).toBeCloseTo(bpm)
  })

  it('stretches and becomes scrollable when zoomed in', () => {
    const v = { zoom: 2, scrollY: 0 }
    expect(pxPerBpm(v, b)).toBe(4)
    expect(maxScrollY(v, b)).toBe(280)
    expect(scrollYBy(v, 1e9, b).scrollY).toBe(280)
    expect(scrollYBy(v, -50, b)).toBe(v) // already at the top: same object
  })

  it('keeps the BPM under the cursor fixed while zooming', () => {
    const anchorY = 100
    const before = yToBpm(anchorY, fit, b)
    const v = zoomYAt(fit, 4, anchorY, b)
    expect(v.zoom).toBe(4)
    expect(yToBpm(anchorY, v, b)).toBeCloseTo(before)
  })

  it('never zooms out past fit or in past the maximum', () => {
    expect(zoomYAt(fit, 0.5, 100, b)).toBe(fit)
    expect(clampBpmViewport({ zoom: 1e6, scrollY: 0 }, b).zoom).toBe(MAX_ZOOM_Y)
  })

  it('keeps zoom and the centre BPM when the range changes', () => {
    const v = zoomYAt(fit, 4, b.viewHeight / 2, b)
    const centre = yToBpm(b.viewHeight / 2, v, b)
    const next = { ...b, bpmMin: 40, bpmMax: 240 }
    const r = rebound(v, b, next)
    expect(r.zoom).toBe(4)
    expect(yToBpm(next.viewHeight / 2, r, next)).toBeCloseTo(centre)
  })

  it('picks nice tick intervals', () => {
    expect(pickBpmInterval(2, 22)).toBe(20)
    expect(pickBpmInterval(25, 22)).toBe(1)
    expect(pickBpmInterval(8, 22)).toBe(5)
  })

  it('labels the range ends and nice values in between, top first', () => {
    const ticks = visibleBpmTicks(fit, b)
    expect(ticks[0]).toMatchObject({ bpm: 200, major: true })
    expect(ticks.at(-1)).toMatchObject({ bpm: 60, major: true })
    expect(ticks.map((t) => t.bpm)).toEqual([200, 180, 160, 140, 120, 100, 80, 60])
    expect(ticks.find((t) => t.bpm === 100)?.major).toBe(true)
  })

  it('only returns ticks inside the visible window when zoomed', () => {
    const v = clampBpmViewport({ zoom: 10, scrollY: 0 }, b)
    const [lowest] = [...visibleBpmTicks(v, b)].reverse()
    expect(lowest.bpm).toBeGreaterThan(150)
  })
})
