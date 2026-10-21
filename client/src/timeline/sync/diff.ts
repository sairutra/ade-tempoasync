/** Half-open index range [from, to). */
export type Range = { from: number; to: number }

/**
 * The smallest range of `b` that differs from `a`: the first differing index up to one past the
 * last, in `b`'s indices. null if the arrays are equal.
 *
 * Steps are absolute (index i is step i in both arrays), so when the length changes the change
 * always runs to the end of `b`: the range is [first differing index, b.length). The prefix both
 * arrays share is still excluded, so an edit between the last two nodes that also moves the end
 * of the line reports only that segment, not the whole line. When `b` is just `a` cut short, the
 * range is empty ({ from: b.length, to: b.length }) but not null: the line still changed.
 */
export function changedRange(a: readonly number[], b: readonly number[]): Range | null {
  const common = Math.min(a.length, b.length)
  let from = 0
  while (from < common && a[from] === b[from]) from++
  if (a.length !== b.length) return { from, to: b.length }
  if (from === b.length) return null
  let to = b.length
  while (to > from && a[to - 1] === b[to - 1]) to--
  return { from, to }
}
