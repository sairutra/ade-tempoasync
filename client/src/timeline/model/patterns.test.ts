import { describe, expect, it } from 'vitest'
import { buildNewTrack, NEW_TRACK_MIN_STEPS } from './newTrack'
import {
  DEFAULT_RANDOM,
  DEFAULT_SPLIT,
  DEFAULT_WAVE,
  generatePattern,
  patternError,
  patternLength,
  patternWindowSteps,
  quantizeInSync,
  splitRestBpm,
  waveValue,
  waveWindowSteps,
  WAVE_SHAPES,
  type PatternSpec,
} from './patterns'
import { createTimelineState } from './selectors'
import { DEFAULT_SEQUENCE } from './sequence'
import { stepToTime, STEPS_PER_BAR } from './tempo'

/** Elapsed seconds after each window of `window` steps. */
function windowEnds(bpms: readonly number[], window: number): number[] {
  const ends: number[] = []
  let t = 0
  bpms.forEach((bpm, i) => {
    t += stepToTime(1, bpm)
    if ((i + 1) % window === 0) ends.push(t)
  })
  return ends
}

function expectInSync(bpms: readonly number[], window: number, syncBpm: number, toleranceSeconds: number) {
  const ends = windowEnds(bpms, window)
  expect(ends.length).toBeGreaterThan(0)
  ends.forEach((t, k) => expect(Math.abs(t - stepToTime((k + 1) * window, syncBpm))).toBeLessThan(toleranceSeconds))
}

const specs: PatternSpec[] = [
  DEFAULT_WAVE,
  { ...DEFAULT_WAVE, shape: 'pulse', pulseWidth: 0.25, cyclesPerBar: 0.5 },
  { ...DEFAULT_WAVE, shape: 'sawtooth', cyclesPerBar: 1.5, amplitude: 40 },
  { ...DEFAULT_RANDOM, seed: 7 },
  { ...DEFAULT_RANDOM, seed: 7, smooth: false, stepsPerChange: 1, syncBars: 2 },
  { ...DEFAULT_SPLIT, windowBpm: 140 },
  { kind: 'split', periodSteps: 32, windowSteps: 7, windowBpm: 133 },
]

describe('waves', () => {
  it('stay in [-1, 1] and start at 0 or high', () => {
    for (const shape of WAVE_SHAPES) {
      for (let p = 0; p < 2; p += 0.01) expect(Math.abs(waveValue(shape, p, 0.3))).toBeLessThanOrEqual(1 + 1e-12)
      expect(waveValue(shape, 0, 0.3)).toBeGreaterThanOrEqual(0)
    }
    expect(waveValue('sine', 0.25)).toBeCloseTo(1)
    expect(waveValue('triangle', 0.75)).toBeCloseTo(-1)
    expect(waveValue('pulse', 0.2, 0.25)).toBe(1)
    expect(waveValue('pulse', 0.3, 0.25)).toBe(-1)
  })

  it('repeat over the shortest whole number of bars with whole cycles', () => {
    expect(waveWindowSteps(1)).toBe(STEPS_PER_BAR)
    expect(waveWindowSteps(2)).toBe(STEPS_PER_BAR)
    expect(waveWindowSteps(0.25)).toBe(4 * STEPS_PER_BAR)
    expect(waveWindowSteps(1.5)).toBe(2 * STEPS_PER_BAR)
    expect(waveWindowSteps(0.75)).toBe(4 * STEPS_PER_BAR)
  })

  it('drift without sync, and keep time with it', () => {
    const raw = generatePattern({ ...DEFAULT_WAVE, sync: false }, 120, 64)
    expect(windowEnds(raw, 16)[0]).toBeGreaterThan(stepToTime(16, 120) + 1e-3)
    expectInSync(generatePattern(DEFAULT_WAVE, 120, 64), 16, 120, 1e-9)
  })
})

describe('split pattern', () => {
  it('fills the rest of the period with the BPM that keeps it in sync', () => {
    // 3 beats at 140 take 9/7 s; the 4th beat must fit the remaining 5/7 s → 84 BPM.
    expect(splitRestBpm({ periodSteps: 16, windowSteps: 12, windowBpm: 140 }, 120)).toBeCloseTo(84, 9)
    const bpms = generatePattern({ ...DEFAULT_SPLIT, windowBpm: 140 }, 120, 32)
    expect(bpms.slice(0, 12).every((b) => b === 140)).toBe(true)
    expect(bpms[12]).toBeCloseTo(84)
    expect(bpms[16]).toBe(140)
  })

  it('rejects a window that leaves no time, or needs an impossible BPM', () => {
    expect(patternError({ kind: 'split', periodSteps: 16, windowSteps: 12, windowBpm: 90 }, 120)).toMatch(/too slow/)
    expect(patternError({ kind: 'split', periodSteps: 16, windowSteps: 15, windowBpm: 112.6 }, 120)).toMatch(/would need/)
    expect(patternError({ kind: 'split', periodSteps: 16, windowSteps: 16, windowBpm: 120 }, 120)).toMatch(/leave part/)
  })
})

describe('random pattern', () => {
  it('is reproducible from its seed and stays near the amplitude', () => {
    const a = generatePattern({ ...DEFAULT_RANDOM, seed: 3 }, 120, 128)
    expect(generatePattern({ ...DEFAULT_RANDOM, seed: 3 }, 120, 128)).toEqual(a)
    expect(generatePattern({ ...DEFAULT_RANDOM, seed: 4 }, 120, 128)).not.toEqual(a)
    for (const b of a) expect(Math.abs(b - 120)).toBeLessThan(30)
  })
})

describe('every pattern', () => {
  it('keeps time with the sync BPM at each window end, also after rounding', () => {
    for (const spec of specs) {
      const window = patternWindowSteps(spec)
      const length = patternLength(spec, 600)
      expect(length % window).toBe(0)
      const exact = generatePattern(spec, 120, length)
      expectInSync(exact, window, 120, 1e-9)
      const rounded = quantizeInSync(exact)
      for (const b of rounded) expect(Math.round(b * 10) / 10).toBeCloseTo(b, 9)
      expectInSync(rounded, window, 120, 1e-3)
    }
  })
})

describe('quantizeInSync', () => {
  it("doesn't let rounding drift", () => {
    const bpms = Array(10_000).fill(111.43)
    const plainEnd = windowEnds(bpms.map((b) => Math.round(b * 10) / 10), 10_000)[0]
    const exactEnd = stepToTime(10_000, 111.43)
    expect(Math.abs(plainEnd - exactEnd)).toBeGreaterThan(0.005)
    expect(Math.abs(windowEnds(quantizeInSync(bpms), 10_000)[0] - exactEnd)).toBeLessThan(1e-3)
  })
})

describe('buildNewTrack with a pattern', () => {
  it('generates the line, rounded up to whole windows, with nodes at the bends', () => {
    const track = buildNewTrack(createTimelineState([]), {
      name: 'Split', color: '#3d85c6', bpm: 120, channel: 2, sequence: [...DEFAULT_SEQUENCE],
      pattern: { kind: 'split', periodSteps: 48, windowSteps: 36, windowBpm: 140 },
    })
    expect(track.bpms.length % 48).toBe(0)
    expect(track.bpms.length).toBeGreaterThanOrEqual(NEW_TRACK_MIN_STEPS)
    expect(track.nodes).toEqual(expect.arrayContaining([0, 35, 36, 47, 48]))
    expectInSync(track.bpms, 48, 120, 1e-3)
  })

  it('throws on an invalid pattern', () => {
    expect(() => buildNewTrack(createTimelineState([]), {
      name: 'X', color: '#000000', bpm: 120, channel: 1, sequence: [...DEFAULT_SEQUENCE],
      pattern: { ...DEFAULT_WAVE, amplitude: 200 },
    })).toThrow(/Invalid pattern/)
  })
})
