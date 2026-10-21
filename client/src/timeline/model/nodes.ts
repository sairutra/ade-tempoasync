/**
 * Editing nodes: the bends of a track's line. Pure functions over `bpms` + `nodes` indices
 * (see Track in types.ts). Every edit keeps the invariant that the points between two consecutive
 * nodes lie on the straight line joining them, by re-sampling only the segments it touches.
 */

/**
 * Loaded data is rounded (the mock uses 0.1 BPM), so a "straight" run can wobble by up to one
 * rounding step. Points within this distance of a straight line don't count as a bend.
 */
export const STRAIGHT_TOLERANCE_BPM = 0.1 + 1e-9

/** Edited BPMs are rounded to this resolution. */
export const EDIT_RESOLUTION_BPM = 0.1

/**
 * Indices where the line changes direction, plus the first and last point. Greedy: from each node,
 * extend the segment as far as every point in between stays within `tolerance` of the straight
 * line to the candidate end. A flat-then-ramp corner, a step jump (two nodes) and every vertex of a
 * curve all become nodes; the points of a straight run do not.
 */
export function deriveNodes(bpms: readonly number[], tolerance = STRAIGHT_TOLERANCE_BPM): number[] {
  const last = bpms.length - 1
  const nodes = [0]
  let start = 0
  while (start < last) {
    let end = start + 1
    while (end < last && isStraight(bpms, start, end + 1, tolerance)) end++
    nodes.push(end)
    start = end
  }
  return nodes
}

function isStraight(bpms: readonly number[], a: number, b: number, tolerance: number): boolean {
  for (let i = a + 1; i < b; i++) {
    if (Math.abs(bpms[i] - lerpAt(bpms, a, b, i)) > tolerance) return false
  }
  return true
}

function lerpAt(bpms: readonly number[], a: number, b: number, i: number): number {
  return bpms[a] + ((bpms[b] - bpms[a]) * (i - a)) / (b - a)
}

/** Overwrites the points strictly between nodes a and b with the straight line between them. */
function resample(bpms: number[], a: number, b: number): void {
  for (let i = a + 1; i < b; i++) bpms[i] = lerpAt(bpms, a, b, i)
}

export function roundBpm(bpm: number): number {
  return Math.round(bpm / EDIT_RESOLUTION_BPM) * EDIT_RESOLUTION_BPM
}

/** True if `nodes` is a valid node list for a track of `length` points. */
export function isValidNodes(nodes: readonly number[], length: number): boolean {
  if (nodes[0] !== 0 || nodes[nodes.length - 1] !== length - 1) return false
  for (let i = 1; i < nodes.length; i++) {
    if (!Number.isInteger(nodes[i]) || nodes[i] <= nodes[i - 1]) return false
  }
  return true
}

type Line = { bpms: number[]; nodes: number[] }

/**
 * Moves node `index` (an index into bpms, which must be a node) to `bpm`, and redraws the two
 * segments either side of it so every step in between follows the new straight lines.
 */
export function setNodeBpm(line: Line, index: number, bpm: number): Line {
  const k = line.nodes.indexOf(index)
  if (k === -1) throw new Error(`Step ${index} is not a node`)
  if (line.bpms[index] === bpm) return line
  const bpms = line.bpms.slice()
  bpms[index] = bpm
  if (k > 0) resample(bpms, line.nodes[k - 1], index)
  if (k < line.nodes.length - 1) resample(bpms, index, line.nodes[k + 1])
  return { bpms, nodes: line.nodes }
}

/**
 * Adds a node at `index` without changing the line's shape: inside the line it takes the BPM
 * already there; past the last point the line is extended, holding the last BPM up to the new node.
 * Returns the line unchanged if `index` is already a node.
 */
export function addNode(line: Line, index: number): Line {
  if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid node step ${index}`)
  const last = line.bpms.length - 1
  if (index > last) {
    const bpms = line.bpms.concat(Array<number>(index - last).fill(line.bpms[last]))
    // The old last node stays: it is now the corner between the old line and the held part.
    return { bpms, nodes: [...line.nodes, index] }
  }
  const at = insertionPoint(line.nodes, index)
  if (line.nodes[at] === index) return line
  return { bpms: line.bpms, nodes: [...line.nodes.slice(0, at), index, ...line.nodes.slice(at)] }
}

/** First position in sorted `nodes` whose value is >= index. */
function insertionPoint(nodes: readonly number[], index: number): number {
  let lo = 0
  let hi = nodes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (nodes[mid] < index) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Removes node `index` and redraws the points between its neighbours a and b as the straight line
 * from a to b. The first and last nodes bound the line, so they can't be removed: the line is
 * returned unchanged for them.
 */
export function removeNode(line: Line, index: number): Line {
  const k = line.nodes.indexOf(index)
  if (k === -1) throw new Error(`Step ${index} is not a node`)
  if (k === 0 || k === line.nodes.length - 1) return line
  const [a, b] = [line.nodes[k - 1], line.nodes[k + 1]]
  const bpms = line.bpms.slice()
  resample(bpms, a, b)
  return { bpms, nodes: [...line.nodes.slice(0, k), ...line.nodes.slice(k + 1)] }
}

/** A line with its position: what a horizontal node move can change. */
type PlacedLine = Line & { startStep: number }

/**
 * Absolute steps node `index` may move to horizontally: strictly between its neighbours, so it can
 * never reach or pass them (at most one step after the previous node, one step before the next).
 * The first node can move back to step 0, which moves the start of the line; the last node can move
 * forward without limit, stretching its segment (`max` is Infinity).
 */
export function nodeMoveRange(line: PlacedLine, index: number): { min: number; max: number } {
  const k = line.nodes.indexOf(index)
  if (k === -1) throw new Error(`Step ${index} is not a node`)
  const { startStep, nodes } = line
  const min = k > 0 ? startStep + nodes[k - 1] + 1 : Math.min(0, startStep)
  const max = k < nodes.length - 1 ? startStep + nodes[k + 1] - 1 : Infinity
  return { min, max }
}

/**
 * Moves node `index` horizontally to absolute step `toStep` (clamped by nodeMoveRange), keeping its
 * BPM, and redraws the segments either side of it as the straight lines to its neighbours. The other
 * nodes keep their absolute steps and BPMs, so a move is lossless: moving back restores the line.
 *
 * Moving the first node moves the start of the line (startStep) and re-indexes the rest; moving the
 * last node lengthens or shortens the line (it holds its last BPM past the end, as before).
 */
export function moveNode(line: PlacedLine, index: number, toStep: number): PlacedLine {
  const { min, max } = nodeMoveRange(line, index)
  const target = Math.min(max, Math.max(min, Math.round(toStep)))
  const { startStep, bpms, nodes } = line
  const to = target - startStep // relative to the current start; negative only for the first node
  if (to === index) return line
  const k = nodes.indexOf(index)
  const last = nodes.length - 1
  const bpm = bpms[index]

  if (k === 0) {
    // Re-index everything after the first node from the new start.
    const shift = -to
    const rest = nodes.slice(1)
    if (rest.length === 0) return { startStep: target, bpms, nodes }
    const next = rest[0]
    const newBpms = [bpm, ...Array<number>(next + shift - 1).fill(0), ...bpms.slice(next)]
    resample(newBpms, 0, next + shift)
    return { startStep: target, bpms: newBpms, nodes: [0, ...rest.map((i) => i + shift)] }
  }

  const prev = nodes[k - 1]
  if (k === last) {
    const newBpms = bpms.slice(0, Math.min(bpms.length, to + 1))
    while (newBpms.length < to + 1) newBpms.push(0)
    newBpms[to] = bpm
    resample(newBpms, prev, to)
    return { startStep, bpms: newBpms, nodes: [...nodes.slice(0, last), to] }
  }

  const newBpms = bpms.slice()
  newBpms[to] = bpm
  resample(newBpms, prev, to)
  resample(newBpms, to, nodes[k + 1])
  const newNodes = nodes.slice()
  newNodes[k] = to
  return { startStep, bpms: newBpms, nodes: newNodes }
}

/**
 * Moves every point of `base` by `delta` BPM. The shape is unchanged, so the nodes stay valid.
 * Taking the points at the start of a drag (rather than the current ones) keeps repeated shifts
 * from accumulating floating-point error.
 */
export function shiftBpms(base: readonly number[], delta: number): number[] {
  return base.map((bpm) => bpm + delta)
}

/**
 * Limits a whole-line shift so no point leaves [bpmMin, bpmMax]. A line that already sticks out of
 * the range can still move back towards it, but not further out.
 */
export function clampShift(bpms: readonly number[], delta: number, bpmMin: number, bpmMax: number): number {
  let lo = Infinity
  let hi = -Infinity
  for (const bpm of bpms) {
    if (bpm < lo) lo = bpm
    if (bpm > hi) hi = bpm
  }
  const down = Math.min(0, bpmMin - lo)
  const up = Math.max(0, bpmMax - hi)
  return Math.min(up, Math.max(down, delta))
}
