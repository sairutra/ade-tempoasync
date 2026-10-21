/** Half-open index range [from, to). */
export type Range = { from: number; to: number }

/**
 * The smallest range of `b` that differs from `a`: the first differing index up to one past the
 * last. null if the arrays are equal. A length change (adding or moving a node past the end of the
 * line) returns the whole of `b`.
 */
export function changedRange(a: readonly number[], b: readonly number[]): Range | null {
  if (a.length !== b.length) return { from: 0, to: b.length }
  let from = 0
  while (from < b.length && a[from] === b[from]) from++
  if (from === b.length) return null
  let to = b.length
  while (to > from && a[to - 1] === b[to - 1]) to--
  return { from, to }
}
