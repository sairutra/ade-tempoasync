import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { clampShift, nodeMoveRange, roundBpm, snapDragDelta } from '../model/nodes'
import { bpmToFraction, clampBpm } from '../model/selectors'
import { lineBeats, lineStepAt, lineTimeAt, lineTiming, type LineTiming } from '../model/syncView'
import { STEPS_PER_BAR, STEPS_PER_BEAT, stepToTime, timeToStep } from '../model/tempo'
import { buildTrackPath, trackViewBox } from '../model/trackPath'
import type { Track } from '../model/types'
import { GRID_MIN_MINOR_SPACING_PX } from '../viewport/ticks'

type Props = {
  track: Track
  pxPerSecond: number
  projectBpm: number
  bpmMin: number
  bpmMax: number
  /** Timeline end in steps; the line holds its last BPM until here. */
  contentEndStep: number
  /** Node indices (into bpms) are also steps: lines start at step 0. Must be stable (memo deps). */
  onAddNode: (trackId: string, index: number) => void
  onSetNodeBpm: (trackId: string, index: number, bpm: number) => void
  onRemoveNode: (trackId: string, index: number) => void
  /** Moves a node horizontally from step `fromStep` to `toStep`. Must be stable. */
  onMoveNode: (trackId: string, fromStep: number, toStep: number) => void
  /** Sets the track's points to `base` moved by `delta` BPM. */
  onShiftLine: (trackId: string, base: readonly number[], delta: number) => void
  /** Called once when a drag (node or whole line) begins and once when it ends. Must be stable. */
  onDragStart: () => void
  onDragEnd: () => void
  /**
   * Sync view: draw each point at the real time it sounds (see syncView.ts) instead of at its
   * step on the project grid, with beat ticks on the line. Editing stays in steps.
   */
  syncView?: boolean
  /** Highlighted in sync view. */
  selected?: boolean
  /** Called when the line or one of its nodes is pressed. Must be stable. */
  onSelect?: (trackId: string) => void
}

/** Below this many pixels per step, node handles shrink so a dense curve stays readable. */
const DENSE_PX_PER_STEP = 8

/** A node drag picks its axis once the pointer has moved this far, and keeps it until release. */
const AXIS_LOCK_PX = 4

/** Sync view: downbeat ticks are hidden when bars are closer than this (px). */
const MIN_BAR_TICK_SPACING_PX = 6

type Axis = 'x' | 'y'

type Drag =
  /**
   * Dragging one node, either vertically (BPM) or horizontally (step) — never both in one drag.
   * `step` is the node's current step: a horizontal move changes it, so it's tracked here.
   */
  | {
      kind: 'node'
      pointerId: number
      startX: number
      startY: number
      /** Step of the node when the drag began. */
      originStep: number
      step: number
      startBpm: number
      axis: Axis | null
      range: { min: number; max: number } | null
      /** Sync view: the line's timing when the drag began, so pointer → step doesn't shift under the drag. */
      timing: LineTiming | null
    }
  /** Ctrl+drag: moving the whole line vertically, from its points at the start of the drag. */
  | { kind: 'line'; pointerId: number; startY: number; base: readonly number[] }

/**
 * One SVG per track, spanning the whole timeline: from step 0 to the timeline end. The viewBox is in model
 * units (steps × BPM) with preserveAspectRatio="none", so zooming only changes the svg's CSS width;
 * the path string is rebuilt only when the points, the BPM range or the content end change.
 * `vector-effect: non-scaling-stroke` keeps the stroke width constant under that stretch.
 * Re-renders only on track/zoom/range changes — never on scroll.
 *
 * Editing: every node is a handle (HTML, so it stays round under the stretched viewBox). A drag
 * moves it either vertically (BPM) or horizontally (step), never both: the first few pixels of
 * movement pick the axis, which then holds until release. Horizontally a node stays strictly between
 * its neighbours; the first node stays at step 0 (it only moves vertically, since every line starts
 * there) and the last can move forward freely (lengthening the points). Pressing anywhere else on the line — including the held part after the last point —
 * adds a node at the nearest step and drags it in the same gesture. Right-clicking a node removes
 * it (the line between its neighbours becomes straight); the first and last nodes stay.
 * Ctrl+dragging the line or any node moves the whole line up or down, keeping its shape within the
 * BPM range. Drags are relative to where the press started, so grabbing the line never makes it jump.
 * Vertical drags (a node or the whole line) move in whole BPM steps; holding Alt switches to 0.1.
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
  onMoveNode,
  onShiftLine,
  onDragStart,
  onDragEnd,
  syncView = false,
  selected = false,
  onSelect,
}: Props) {
  const { bpms, nodes } = track
  const timing = useMemo(() => (syncView ? lineTiming(bpms) : null), [bpms, syncView])
  // Path x units are project steps in both views; in sync view a point sits at its real onset.
  const xs = useMemo(
    () => (timing ? timing.onsets.map((t) => timeToStep(t, projectBpm)) : undefined),
    [timing, projectBpm],
  )
  /** The line's own last step on screen: its last point, or wherever it reaches the timeline end. */
  const lineEndStep = timing
    ? Math.max(bpms.length - 1, lineStepAt(timing, stepToTime(contentEndStep, projectBpm)))
    : Math.max(bpms.length - 1, contentEndStep)
  const widthSteps = xs ? Math.max(xs[xs.length - 1], contentEndStep) : lineEndStep
  const path = useMemo(
    () => buildTrackPath(bpms, bpmMin, bpmMax, widthSteps, xs),
    [bpms, bpmMin, bpmMax, widthSteps, xs],
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  /** Step of the node being dragged, and the axis once the drag has picked one. */
  const [dragStep, setDragStep] = useState<number | null>(null)
  const [dragAxis, setDragAxis] = useState<Axis | null>(null)
  const [shifting, setShifting] = useState(false)

  const pxPerStep = stepToTime(1, projectBpm) * pxPerSecond
  const width = Math.max(1, widthSteps * pxPerStep)
  const color = { '--tl-line-color': track.color } as CSSProperties
  const labelTop = bpmToFraction(bpms[0], bpmMin, bpmMax) * 100
  const bpmAt = (index: number) => (index < bpms.length ? bpms[index] : bpms[bpms.length - 1])
  /** Content x (px) of a line step. */
  const stepX = (step: number) => (timing ? lineTimeAt(timing, step) * pxPerSecond : step * pxPerStep)
  /** Line step under content x (px); fractional. */
  const xStep = (x: number) => (timing ? lineStepAt(timing, x / pxPerSecond) : timeToStep(x / pxPerSecond, projectBpm))

  // Sync view: beat ticks, dropped when they would crowd (the line's fastest BPM sets the spacing).
  const fastest = useMemo(() => Math.max(...bpms), [bpms])
  const showBeats = stepToTime(STEPS_PER_BEAT, fastest) * pxPerSecond >= GRID_MIN_MINOR_SPACING_PX
  const showBars = stepToTime(STEPS_PER_BAR, fastest) * pxPerSecond >= MIN_BAR_TICK_SPACING_PX
  const endTime = stepToTime(widthSteps, projectBpm)
  const beats = useMemo(
    () => (timing && showBars ? lineBeats(timing, endTime, projectBpm, showBeats) : []),
    [timing, showBars, showBeats, endTime, projectBpm],
  )

  // Unmounting mid-drag still ends it, so backend sync doesn't stay paused.
  useEffect(
    () => () => {
      if (dragRef.current) onDragEnd()
    },
    [onDragEnd],
  )

  const startDrag = (e: PointerEvent<Element>, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    // Out-of-range points are drawn clamped; dragging starts from where the handle is drawn.
    dragRef.current = {
      kind: 'node',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originStep: index,
      step: index,
      startBpm: clampBpm(bpmAt(index), bpmMin, bpmMax),
      axis: null,
      range: null,
      timing,
    }
    onDragStart()
    setDragStep(index)
  }

  const startShift = (e: PointerEvent<Element>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'line', pointerId: e.pointerId, startY: e.clientY, base: bpms }
    onDragStart()
    setShifting(true)
  }

  const onLinePointerDown = (e: PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect?.(track.id)
    if (e.ctrlKey) {
      startShift(e)
      return
    }
    const dx = e.clientX - svgRef.current!.getBoundingClientRect().left
    const index = Math.min(Math.floor(lineEndStep), Math.max(0, Math.round(xStep(dx))))
    if (!nodes.includes(index)) onAddNode(track.id, index)
    startDrag(e, index)
  }

  const onNodePointerDown = (e: PointerEvent<HTMLSpanElement>, index: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect?.(track.id)
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
    const dx = e.clientX - (drag.kind === 'node' ? drag.startX : 0)
    const dy = e.clientY - drag.startY
    const bpmPerPx = (bpmMax - bpmMin) / svgRef.current!.getBoundingClientRect().height
    // Whole BPM steps by default; Alt for 0.1. Read per move, so Alt can be toggled mid-drag.
    const dBpm = snapDragDelta(-dy * bpmPerPx, e.altKey)
    if (drag.kind === 'line') {
      onShiftLine(track.id, drag.base, clampShift(drag.base, dBpm, bpmMin, bpmMax))
      return
    }
    const index = drag.step
    if (drag.axis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return
      // A node added by pressing the line may not have rendered yet: wait for it.
      if (!nodes.includes(index)) return
      // The first node is pinned to step 0 (every line starts there), so it only moves vertically.
      drag.axis = index !== 0 && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      // The neighbours never move during this drag, so the bounds are fixed for its whole length.
      if (drag.axis === 'x') drag.range = nodeMoveRange(track, index)
      setDragAxis(drag.axis)
    }
    if (drag.axis === 'x') {
      const { min, max } = drag.range!
      // Sync view: steps aren't evenly spaced, so map the pointer through the line's onsets
      // (as they were when the drag began) rather than a constant px per step.
      const moved = drag.timing
        ? Math.round(lineStepAt(drag.timing, lineTimeAt(drag.timing, drag.originStep) + dx / pxPerSecond))
        : drag.originStep + Math.round(dx / pxPerStep)
      const target = Math.min(max, Math.max(min, moved))
      if (target === drag.step) return
      onMoveNode(track.id, drag.step, target)
      drag.step = target
      setDragStep(target)
      return
    }
    const bpm = clampBpm(roundBpm(drag.startBpm + dBpm), bpmMin, bpmMax)
    onSetNodeBpm(track.id, index, bpm)
  }

  const endDrag = (e: PointerEvent<Element>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    onDragEnd()
    setDragStep(null)
    setDragAxis(null)
    setShifting(false)
  }

  const dragHandlers = { onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }

  return (
    <>
      <svg
        ref={svgRef}
        className="tl-line"
        data-shifting={shifting || undefined}
        data-axis={dragAxis ?? undefined}
        data-selected={(syncView && selected) || undefined}
        style={{ ...color, width }}
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
          <title>{`${track.name} — click to add a node, Ctrl+drag to move the line, Alt for 0.1 BPM steps`}</title>
        </path>
      </svg>
      {beats.map((beat) => (
        <span
          key={beat.step}
          className="tl-line-tick"
          data-level={beat.level}
          data-sync={beat.inSync || undefined}
          style={{
            ...color,
            left: beat.time * pxPerSecond,
            top: `${bpmToFraction(bpmAt(beat.step), bpmMin, bpmMax) * 100}%`,
          }}
        />
      ))}
      <span className="tl-line-name" style={{ ...color, top: `${labelTop}%`, transform: 'translateY(calc(-100% - 4px))' }}>
        {track.name}
      </span>
      {nodes.map((index, k) => {
        const active = dragStep === index
        return (
          <span
            // Keyed by position, not step: a horizontal drag changes the node's step, and a new key
            // would remount the handle and drop its pointer capture mid-drag. Nodes never pass each
            // other, so the dragged node keeps its position.
            key={k}
            className="tl-node"
            data-dense={pxPerStep < DENSE_PX_PER_STEP || undefined}
            data-active={active || undefined}
            data-axis={(active && dragAxis) || undefined}
            style={{ ...color, left: stepX(index), top: `${bpmToFraction(bpms[index], bpmMin, bpmMax) * 100}%` }}
            title={`${track.name}: ${formatBpm(bpms[index])} BPM${k > 0 && k < nodes.length - 1 ? ' — right-click to remove' : ''}`}
            onPointerDown={(e) => onNodePointerDown(e, index)}
            onContextMenu={(e) => onNodeContextMenu(e, index)}
            {...dragHandlers}
          >
            {active && <span className="tl-node-value">{formatBpm(bpms[index])}</span>}
          </span>
        )
      })}
    </>
  )
})

function formatBpm(bpm: number): string {
  return bpm.toFixed(1)
}
