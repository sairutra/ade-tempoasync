import { clampBpm } from './selectors'

/**
 * SVG path for a track in model units, relative to its first point:
 * x = steps since startStep, y = bpmMax - bpm (so higher BPM is higher on screen).
 * Matches a viewBox of `0 0 widthSteps (bpmMax - bpmMin)`.
 *
 * `M` the first point, `L` through every other point, then `H` to `widthSteps` (the content end)
 * holding the last BPM. Values outside [bpmMin, bpmMax] are clamped here, never in the model.
 */
export function buildTrackPath(bpms: readonly number[], bpmMin: number, bpmMax: number, widthSteps: number): string {
  const y = (bpm: number) => bpmMax - clampBpm(bpm, bpmMin, bpmMax)
  const parts = [`M0 ${y(bpms[0])}`]
  for (let i = 1; i < bpms.length; i++) parts.push(`L${i} ${y(bpms[i])}`)
  if (widthSteps > bpms.length - 1) parts.push(`H${widthSteps}`)
  return parts.join(' ')
}

export function trackViewBox(bpmMin: number, bpmMax: number, widthSteps: number): string {
  return `0 0 ${widthSteps} ${bpmMax - bpmMin}`
}
