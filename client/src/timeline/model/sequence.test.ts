import { describe, expect, it } from 'vitest'
import { isValidSequence, noteName, parseStep } from './sequence'

describe('parseStep', () => {
  it('accepts integers 0–127 and -1', () => {
    expect(['0', '60', '127', '-1', ' 64 '].map(parseStep)).toEqual([0, 60, 127, -1, 64])
  })

  it('rejects anything else', () => {
    for (const text of ['', ' ', '-', '128', '-2', '60.5', '60.0', '1e2', 'C4', '0x3c']) {
      expect(parseStep(text)).toBeNull()
    }
  })
})

describe('isValidSequence', () => {
  it('takes 1 to 16 valid steps', () => {
    expect(isValidSequence([60])).toBe(true)
    expect(isValidSequence(Array(16).fill(-1))).toBe(true)
    expect(isValidSequence([])).toBe(false)
    expect(isValidSequence(Array(17).fill(60))).toBe(false)
    expect(isValidSequence([60, 128])).toBe(false)
  })
})

describe('noteName', () => {
  it('names notes with middle C as C4', () => {
    expect([60, 61, 69, 0, 127, -1].map(noteName)).toEqual(['C4', 'C#4', 'A4', 'C-1', 'G9', '–'])
  })
})
