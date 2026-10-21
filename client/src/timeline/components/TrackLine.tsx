import { memo, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { clampShift, roundBpm } from '../model/nodes'
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
  onRemoveNode: (trackId: string, index: number) => void
  /** Sets the track's points to `base` moved by `delta` BPM. */
  onShiftLine: (trackId: string, base: readonly number[], delta: number) => void
}

/** Below this many pixels per step, node handles shrink so a dense curve stays readable. */
const DENSE_PX_PER_STEP = 8

type Drag =
  /** Dragging one node vertically. */
  | { kind: 'node'; pointerId: number; startY: number; index: number; startBpm: number }
  /** Ctrl+drag: moving the whole line vertically, from its points at the start of the drag. */
  | { kind: 'line'; pointerId: number; startY: number; base: readonly number[] }

/**
 * One SVG per track, spanning from its first point to the content end. The viewBox is in model
 * units (steps × BPM) with preserveAspectRatio="none", so zooming only changes the svg's CSS width;
 * the path string is rebuilt only when the points, the BPM range or the content end change.
 * `vector-effect: non-scaling-stroke` keeps the stroke width constant under that stretch.
 * Re-renders only on track/zoom/range changes — never on scroll.
 *
 * Editing: every node is a handle (HTML, so it stays round under the stretched viewBox) that drags
 * vertically. Pressing anywhere else on the line — including the held part after the last point —
 * adds a node at the nearest step and drags it in the same gesture. Right-clicking a node removes
 * it (the line between its neighbours becomes straight); the first and last nodes stay.
 * Ctrl+dragging the line or any node moves the whole line up or down, keeping its shape within the
 * BPM range. Drags are relative to where the press started, so grabbing the line never makes it jump.
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
  onRemoveNode,
  onShiftLine,
}: Props) {
  const { bpms, nodes, startStep } = track
  const widthSteps = Math.max(bpms.length - 1, contentEndStep - startStep)
  const path = useMemo(() => buildTrackPath(bpms, bpmMin, bpmMax, widthSteps), [bpms, bpmMin, bpmMax, widthSteps])

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [shifting, setShifting] = useState(false)

  const x = timeToContentX(stepToTime(startStep, projectBpm), pxPerSecond)
  const pxPerStep = stepToTime(1, projectBpm) * pxPerSecond
  const width = Math.max(1, widthSteps * pxPerStep)
  const color = { '--tl-line-color': track.color } as CSSProperties
  const labelTop = bpmToFraction(bpms[0], bpmMin, bpmMax) * 100
  const bpmAt = (index: number) => (index < bpms.length ? bpms[index] : bpms[bpms.length - 1])

  const startDrag = (e: PointerEvent<Element>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    // Out-of-range points are drawn clamped; dragging starts from where the handle is drawn.
    dragRef.current = { kind: 'node', pointerId: e.pointerId, index, startY: e.clientY, startBpm: clampBpm(bpmAt(index), bpmMin, bpmMax) }
    setDragIndex(index)
  }

  const startShift = (e: PointerEvent<Element>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'line', pointerId: e.pointerId, startY: e.clientY, base: bpms }
    setShifting(true)
  }

  const onLinePointerDown = (e: PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (e.ctrlKey) {
      startShift(e)
      return
    }
    const dx = e.clientX - svgRef.current!.getBoundingClientRect().left
    const index = Math.min(Math.floor(widthSteps), Math.max(0, Math.round(timeToStep(dx / pxPerSecond, projectBpm))))
    if (!nodes.includes(index)) onAddNode(track.id, index)
    startDrag(e, index)
  }

  const onNodePointerDown = (e: PointerEvent<HTMLSpanElement>, index: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (e.ctrlKey) startShift(e)
    else startDrag(e, index)
  }

  const onNodeContextMenu = (e: MouseEvent<HTMLSpanElement>, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    // On macOS Ctrl+click also opens the context menu: that press is a line shift, not a delete.
    if (e.ctrlKey || dragRef.current) return
    onRemoveNode(track.id, index)
  }

  /** A right-click that just misses a node shouldn't open the browser menu over the line. */
  const suppressContextMenu = (e: MouseEvent<Element>) => e.preventDefault()

  const onPointerMove = (e: PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const bpmPerPx = (bpmMax - bpmMin) / svgRef.current!.getBoundingClientRect().height
    const dBpm = -(e.clientY - drag.startY) * bpmPerPx
    if (drag.kind === 'line') {
      onShiftLine(track.id, drag.base, clampShift(drag.base, roundBpm(dBpm), bpmMin, bpmMax))
      return
    }
    const bpm = clampBpm(roundBpm(drag.startBpm + dBpm), bpmMin, bpmMax)
    onSetNodeBpm(track.id, drag.index, bpm)
  }

  const endDrag = (e: PointerEvent<Element>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragIndex(null)
    setShifting(false)
  }

  const dragHandlers = { onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }

  return (
    <>
      <svg
        ref={svgRef}
        className="tl-line"
        data-shifting={shifting || undefined}
        style={{ ...color, width, transform: `translateX(${x}px)` }}
        viewBox={trackViewBox(bpmMin, bpmMax, widthSteps)}
        preserveAspectRatio="none"
        aria-label={track.name}
      >
        <path d={path} vectorEffect="non-scaling-stroke" />
        {/* Wide invisible copy of the line: the click target for adding nodes. */}
        <path
          className="tl-line-hit"
          d={path}
          vectorEffect="non-scaling-stroke"
          onPointerDown={onLinePointerDown}
          onContextMenu={suppressContextMenu}
          {...dragHandlers}
        >
          <title>{`${track.name} — click to add a node, Ctrl+drag to move the line`}</title>
        </path>
      </svg>
      <span className="tl-line-name" style={{ ...color, top: `${labelTop}%`, transform: `translate(${x}px, calc(-100% - 4px))` }}>
        {track.name}
      </span>
      {nodes.map((index, k) => (
        <span
          key={index}
          className="tl-node"
          data-dense={pxPerStep < DENSE_PX_PER_STEP || undefined}
          data-active={dragIndex === index || undefined}
          style={{ ...color, left: x + index * pxPerStep, top: `${bpmToFraction(bpms[index], bpmMin, bpmMax) * 100}%` }}
          title={`${track.name}: ${formatBpm(bpms[index])} BPM${k > 0 && k < nodes.length - 1 ? ' — right-click to remove' : ''}`}
          onPointerDown={(e) => onNodePointerDown(e, index)}
          onContextMenu={(e) => onNodeContextMenu(e, index)}
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
