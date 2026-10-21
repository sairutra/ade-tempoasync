import { describe, expect, it } from 'vitest'
import { changedRange } from './diff'

describe('changedRange', () => {
  it('is null for equal arrays', () => {
    expect(changedRange([1, 2, 3], [1, 2, 3])).toBeNull()
    expect(changedRange([], [])).toBeNull()
  })

  it('covers a single change', () => {
    expect(changedRange([1, 2, 3, 4], [1, 9, 3, 4])).toEqual({ from: 1, to: 2 })
  })

  it('covers from the first to the last change, including unchanged values between', () => {
    expect(changedRange([1, 2, 3, 4, 5], [1, 9, 3, 9, 5])).toEqual({ from: 1, to: 4 })
  })

  it('handles a change at either end', () => {
    expect(changedRange([1, 2, 3], [9, 2, 3])).toEqual({ from: 0, to: 1 })
    expect(changedRange([1, 2, 3], [1, 2, 9])).toEqual({ from: 2, to: 3 })
    expect(changedRange([1, 2, 3], [9, 2, 9])).toEqual({ from: 0, to: 3 })
  })

  it('returns the whole new array when the length changes', () => {
    expect(changedRange([1, 2, 3], [1, 2, 3, 3, 3])).toEqual({ from: 0, to: 5 })
    expect(changedRange([1, 2, 3, 4], [1, 2])).toEqual({ from: 0, to: 2 })
  })
})
