import { memo, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { roundBpm } from '../model/nodes'
import { bpmToFraction, clampBpm } from '../model/selectors'
import { stepToTime, timeToStep } from '../model/tempo'
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
  /** Node indices are offsets from track.startStep. Both must be stable (they are memo deps). */
  onAddNode: (trackId: string, index: number) => void
  onSetNodeBpm: (trackId: string, index: number, bpm: number) => void
}

/** Below this many pixels per step, node handles shrink so a dense curve stays readable. */
const DENSE_PX_PER_STEP = 8

type Drag = { pointerId: number; index: number; startY: number; startBpm: number }

/**
 * One SVG per track, spanning from its first point to the content end. The viewBox is in model
 * units (steps × BPM) with preserveAspectRatio="none", so zooming only changes the svg's CSS width;
 * the path string is rebuilt only when the points, the BPM range or the content end change.
 * `vector-effect: non-scaling-stroke` keeps the stroke width constant under that stretch.
 * Re-renders only on track/zoom/range changes — never on scroll.
 *
 * Editing: every node is a handle (HTML, so it stays round under the stretched viewBox) that drags
 * vertically. Pressing anywhere else on the line — including the held part after the last point —
 * adds a node at the nearest step and drags it in the same gesture. Drags are relative to where
 * the press started, so grabbing the line never makes it jump.
 */
export const TrackLine = memo(function TrackLine({
  track,
  pxPerSecond,
  projectBpm,
  bpmMin,
  bpmMax,
  contentEndStep,
  onAddNode,
  onSetNodeBpm,
}: Props) {
  const { bpms, nodes, startStep } = track
  const widthSteps = Math.max(bpms.length - 1, contentEndStep - startStep)
  const path = useMemo(() => buildTrackPath(bpms, bpmMin, bpmMax, widthSteps), [bpms, bpmMin, bpmMax, widthSteps])

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const x = timeToContentX(stepToTime(startStep, projectBpm), pxPerSecond)
  const pxPerStep = stepToTime(1, projectBpm) * pxPerSecond
  const width = Math.max(1, widthSteps * pxPerStep)
  const color = { '--tl-line-color': track.color } as CSSProperties
  const labelTop = bpmToFraction(bpms[0], bpmMin, bpmMax) * 100
  const bpmAt = (index: number) => (index < bpms.length ? bpms[index] : bpms[bpms.length - 1])

  const startDrag = (e: PointerEvent<Element>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    // Out-of-range points are drawn clamped; dragging starts from where the handle is drawn.
    dragRef.current = { pointerId: e.pointerId, index, startY: e.clientY, startBpm: clampBpm(bpmAt(index), bpmMin, bpmMax) }
    setDragIndex(index)
  }

  const onLinePointerDown = (e: PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const dx = e.clientX - svgRef.current!.getBoundingClientRect().left
    const index = Math.min(Math.floor(widthSteps), Math.max(0, Math.round(timeToStep(dx / pxPerSecond, projectBpm))))
    if (!nodes.includes(index)) onAddNode(track.id, index)
    startDrag(e, index)
  }

  const onNodePointerDown = (e: PointerEvent<HTMLSpanElement>, index: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    startDrag(e, index)
  }

  const onPointerMove = (e: PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const bpmPerPx = (bpmMax - bpmMin) / svgRef.current!.getBoundingClientRect().height
    const bpm = clampBpm(roundBpm(drag.startBpm - (e.clientY - drag.startY) * bpmPerPx), bpmMin, bpmMax)
    onSetNodeBpm(track.id, drag.index, bpm)
  }

  const endDrag = (e: PointerEvent<Element>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragIndex(null)
  }

  const dragHandlers = { onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }

  return (
    <>
      <svg
        ref={svgRef}
        className="tl-line"
        style={{ ...color, width, transform: `translateX(${x}px)` }}
        viewBox={trackViewBox(bpmMin, bpmMax, widthSteps)}
        preserveAspectRatio="none"
        aria-label={track.name}
      >
        <path d={path} vectorEffect="non-scaling-stroke" />
        {/* Wide invisible copy of the line: the click target for adding nodes. */}
        <path className="tl-line-hit" d={path} vectorEffect="non-scaling-stroke" onPointerDown={onLinePointerDown} {...dragHandlers}>
          <title>{`${track.name} — click to add a node`}</title>
        </path>
      </svg>
      <span className="tl-line-name" style={{ ...color, top: `${labelTop}%`, transform: `translate(${x}px, calc(-100% - 4px))` }}>
        {track.name}
      </span>
      {nodes.map((index) => (
        <span
          key={index}
          className="tl-node"
          data-dense={pxPerStep < DENSE_PX_PER_STEP || undefined}
          data-active={dragIndex === index || undefined}
          style={{ ...color, left: x + index * pxPerStep, top: `${bpmToFraction(bpms[index], bpmMin, bpmMax) * 100}%` }}
          title={`${track.name}: ${formatBpm(bpms[index])} BPM`}
          onPointerDown={(e) => onNodePointerDown(e, index)}
          {...dragHandlers}
        >
          {dragIndex === index && <span className="tl-node-value">{formatBpm(bpms[index])}</span>}
        </span>
      ))}
    </>
  )
})

function formatBpm(bpm: number): string {
  return bpm.toFixed(1)
}
