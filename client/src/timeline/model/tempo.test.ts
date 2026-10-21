import { describe, expect, it } from 'vitest'
import { STEPS_PER_BAR, stepToTime, timeToStep } from './tempo'

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
