import { describe, expect, it } from 'vitest'
import { DEFAULT_SEQUENCE, sequenceFromSlots, slotsFromSequence } from './sequence'

describe('sequence slots', () => {
  it('always shows 16 slots, padding a shorter sequence with rests', () => {
    expect(slotsFromSequence([60, 62])).toEqual(['60', '62', ...Array(14).fill('-1')])
  })

  it('round-trips the default sequence', () => {
    expect(sequenceFromSlots(slotsFromSequence(DEFAULT_SEQUENCE))).toEqual([...DEFAULT_SEQUENCE])
  })

  it('is null while any slot is empty or out of range', () => {
    const slots = slotsFromSequence(DEFAULT_SEQUENCE)
    expect(sequenceFromSlots(slots.map((s, i) => (i === 3 ? '' : s)))).toBeNull()
    expect(sequenceFromSlots(slots.map((s, i) => (i === 3 ? '128' : s)))).toBeNull()
  })
})
