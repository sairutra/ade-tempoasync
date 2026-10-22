import { clampBpm } from './selectors'

/**
 * SVG path for a track in model units, from step 0:
 * x = step, y = bpmMax - bpm (so higher BPM is higher on screen).
 * Matches a viewBox of `0 0 widthSteps (bpmMax - bpmMin)`.
 *
 * `M` the first point, `L` through every other point, then `H` to `widthSteps` (the timeline end)
 * holding the last BPM. Values outside [bpmMin, bpmMax] are clamped here, never in the model.
 *
 * `xs` optionally places point i at x = xs[i] instead of i (sync view: each point at its real
 * onset, in project steps); `widthSteps` is then in the same units. xs[0] must be 0.
 */
export function buildTrackPath(
  bpms: readonly number[],
  bpmMin: number,
  bpmMax: number,
  widthSteps: number,
  xs?: readonly number[],
): string {
  const y = (bpm: number) => bpmMax - clampBpm(bpm, bpmMin, bpmMax)
  const x = xs ? (i: number) => formatX(xs[i]) : (i: number) => `${i}`
  const lastX = xs ? xs[bpms.length - 1] : bpms.length - 1
  const parts = [`M0 ${y(bpms[0])}`]
  for (let i = 1; i < bpms.length; i++) parts.push(`L${x(i)} ${y(bpms[i])}`)
  if (widthSteps > lastX) parts.push(`H${xs ? formatX(widthSteps) : widthSteps}`)
  return parts.join(' ')
}

/** Warped x positions are fractional: 4 decimals is far below a pixel and keeps the path short. */
function formatX(x: number): string {
  return `${Math.round(x * 1e4) / 1e4}`
}

export function trackViewBox(bpmMin: number, bpmMax: number, widthSteps: number): string {
  return `0 0 ${widthSteps} ${bpmMax - bpmMin}`
}
