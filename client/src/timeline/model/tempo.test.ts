import { describe, expect, it } from 'vitest'
import { onsetAt, STEPS_PER_BAR, stepAtOnset, stepOnsets, stepToTime, timeToStep } from './tempo'

describe('stepToTime / timeToStep', () => {
  it('converts 16th-note steps to seconds', () => {
    expect(stepToTime(1, 120)).toBe(0.125) // a 16th at 120 BPM
    expect(stepToTime(4, 120)).toBe(0.5) // a beat
    expect(stepToTime(STEPS_PER_BAR, 120)).toBe(2) // a 4/4 bar
    expect(stepToTime(4, 60)).toBe(1)
    expect(stepToTime(0, 97)).toBe(0)
  })

  it('converts seconds to (fractional) steps', () => {
    expect(timeToStep(2, 120)).toBe(16)
    expect(timeToStep(0.0625, 120)).toBe(0.5)
    expect(timeToStep(1, 90)).toBe(6)
  })

  it('round-trips at awkward tempos', () => {
    for (const bpm of [60, 97, 120, 128.5, 174]) {
      for (const step of [0, 1, 3, 16, 77, 1000]) {
        expect(timeToStep(stepToTime(step, bpm), bpm)).toBeCloseTo(step, 9)
      }
    }
  })
})

describe('stepToTime at the project tempo', () => {
  it('maps integer steps to evenly spaced 16th notes', () => {
    const bpm = 120
    for (let step = 1; step < 64; step++) {
      expect(stepToTime(step, bpm) - stepToTime(step - 1, bpm)).toBeCloseTo(0.125, 12)
    }
  })
})

describe('stepOnsets', () => {
  it('is the project grid for a flat line at 120 BPM', () => {
    const onsets = stepOnsets(new Array(33).fill(120), 32)
    onsets.forEach((t, i) => expect(t).toBe(stepToTime(i, 120)))
  })

  it('puts the bar-2 downbeat of a flat 90 BPM line at 2.667 s', () => {
    expect(stepOnsets(new Array(17).fill(90), 16)[16]).toBeCloseTo(8 / 3, 9)
  })

  it('times step i by the BPMs of the steps before it (ramps)', () => {
    const onsets = stepOnsets([60, 120, 240], 2)
    expect(onsets).toEqual([0, 0.25, 0.375])
  })

  it('continues at the last BPM past the final point', () => {
    const onsets = stepOnsets([60, 120], 4)
    expect(onsets).toHaveLength(5)
    expect(onsets).toEqual([0, 0.25, 0.375, 0.5, 0.625])
  })

  it('covers every point even when endStep is shorter', () => {
    expect(stepOnsets([120, 120, 120], 0)).toHaveLength(3)
  })
})

describe('onsetAt / stepAtOnset', () => {
  const bpms = [60, 120, 240]
  const onsets = stepOnsets(bpms, 2) // [0, 0.25, 0.375]

  it('interpolates between steps and extrapolates at the held BPM', () => {
    expect(onsetAt(onsets, 240, 1)).toBe(0.25)
    expect(onsetAt(onsets, 240, 0.5)).toBe(0.125)
    expect(onsetAt(onsets, 240, 2 + 16)).toBeCloseTo(0.375 + 1, 12) // 16 steps at 240 = 1 s
  })

  it('maps time back to a step', () => {
    expect(stepAtOnset(onsets, 240, 0)).toBe(0)
    expect(stepAtOnset(onsets, 240, 0.25)).toBe(1)
    expect(stepAtOnset(onsets, 240, 0.3125)).toBeCloseTo(1.5, 12)
    expect(stepAtOnset(onsets, 240, 1.375)).toBeCloseTo(18, 12)
  })

  it('round-trips on a long ramp', () => {
    const ramp = Array.from({ length: 200 }, (_, i) => 60 + i)
    const o = stepOnsets(ramp, 199)
    for (const step of [0, 0.3, 7, 99.5, 199, 250.25]) {
      expect(stepAtOnset(o, 259, onsetAt(o, 259, step))).toBeCloseTo(step, 9)
    }
  })
})
