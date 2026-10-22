import { describe, expect, it } from 'vitest'
import {
  colorDistance,
  distinctColor,
  MIN_COLOR_DISTANCE,
  normalizeHex,
  parseHex,
  suggestColor,
  TRACK_PALETTE,
} from './colors'

const dist = (a: string, b: string) => colorDistance(parseHex(a)!, parseHex(b)!)

describe('normalizeHex', () => {
  it('lower-cases and expands short hex', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('E07A5F')).toBe('#e07a5f')
  })

  it('rejects non-hex input', () => {
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
  })
})

describe('distinctColor', () => {
  it('keeps a colour nobody uses', () => {
    expect(distinctColor('#3D85C6', ['#e07a5f'])).toBe('#3d85c6')
  })

  it('shifts an exact duplicate to a nearby but distinct shade', () => {
    const out = distinctColor('#e07a5f', ['#e07a5f'])
    expect(out).not.toBe('#e07a5f')
    expect(dist(out, '#e07a5f')).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE)
    // "Slightly": one shade step, not a different colour.
    expect(dist(out, '#e07a5f')).toBeLessThan(120)
  })

  it('treats a near-identical colour as the same', () => {
    expect(distinctColor('#e17a5f', ['#e07a5f'])).not.toBe('#e17a5f')
  })

  it('avoids every used colour, including earlier adjusted shades', () => {
    const used: string[] = []
    for (let i = 0; i < 6; i++) used.push(distinctColor('#e07a5f', used))
    expect(new Set(used).size).toBe(6)
    for (let i = 0; i < used.length; i++) {
      for (let j = i + 1; j < used.length; j++) expect(dist(used[i], used[j])).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE)
    }
  })

  it('handles colours with no lightness headroom', () => {
    for (const c of ['#ffffff', '#000000']) {
      const out = distinctColor(c, [c])
      expect(dist(out, c)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE)
    }
  })

  it('ignores invalid used colours and throws on an invalid pick', () => {
    expect(distinctColor('#3d85c6', ['nope'])).toBe('#3d85c6')
    expect(() => distinctColor('nope', [])).toThrow()
  })
})

describe('suggestColor', () => {
  it('returns the first unused palette colour', () => {
    expect(suggestColor([])).toBe(TRACK_PALETTE[0])
    expect(suggestColor([TRACK_PALETTE[0], TRACK_PALETTE[1]])).toBe(TRACK_PALETTE[2])
  })

  it('still returns a distinct colour when the palette is used up', () => {
    const out = suggestColor(TRACK_PALETTE)
    for (const c of TRACK_PALETTE) expect(dist(out, c)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE)
  })
})
