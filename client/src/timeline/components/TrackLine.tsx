import { memo, useMemo, type CSSProperties } from 'react'
import { bpmToFraction } from '../model/selectors'
import { stepToTime } from '../model/tempo'
import { buildTrackPath, trackViewBox } from '../model/trackPath'
import type { Track } from '../model/types'
import { timeToContentX } from '../viewport/viewport'

type Props = {
  track: Track
  pxPerSecond: number
  projectBpm: number
  bpmMin: number
  bpmMax: number
  /** Content end in steps; the line holds its last BPM until here. */
  contentEndStep: number
}

/**
 * One SVG per track, spanning from its first point to the content end. The viewBox is in model
 * units (steps × BPM) with preserveAspectRatio="none", so zooming only changes the svg's CSS width;
 * the path string is rebuilt only when the points, the BPM range or the content end change.
 * `vector-effect: non-scaling-stroke` keeps the stroke width constant under that stretch.
 * Re-renders only on track/zoom/range changes — never on scroll.
 */
export const TrackLine = memo(function TrackLine({ track, pxPerSecond, projectBpm, bpmMin, bpmMax, contentEndStep }: Props) {
  const { bpms, startStep } = track
  const widthSteps = Math.max(bpms.length - 1, contentEndStep - startStep)
  const path = useMemo(() => buildTrackPath(bpms, bpmMin, bpmMax, widthSteps), [bpms, bpmMin, bpmMax, widthSteps])

  const x = timeToContentX(stepToTime(startStep, projectBpm), pxPerSecond)
  const width = Math.max(1, stepToTime(widthSteps, projectBpm) * pxPerSecond)
  const color = { '--tl-line-color': track.color } as CSSProperties
  const labelTop = bpmToFraction(bpms[0], bpmMin, bpmMax) * 100

  return (
    <>
      <svg
        className="tl-line"
        style={{ ...color, width, transform: `translateX(${x}px)` }}
        viewBox={trackViewBox(bpmMin, bpmMax, widthSteps)}
        preserveAspectRatio="none"
        aria-label={track.name}
      >
        <path d={path} vectorEffect="non-scaling-stroke">
          <title>{track.name}</title>
        </path>
      </svg>
      <span className="tl-line-name" style={{ ...color, top: `${labelTop}%`, transform: `translate(${x}px, calc(-100% - 4px))` }}>
        {track.name}
      </span>
    </>
  )
})
