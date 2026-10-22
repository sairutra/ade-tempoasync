import { useCallback, useRef, type PointerEvent } from 'react'
import { visibleBpmTicks, type BpmBounds, type BpmViewport } from '../viewport/bpmViewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

type Props = {
  viewport: BpmViewport
  bounds: BpmBounds
  scrollYTo: (scrollY: number) => void
  zoomYToFit: () => void
}

/**
 * The lane area's y-axis: BPM labels from bpmMin (bottom) to bpmMax (top), at the same positions
 * as the horizontal grid lines. Dragging it pans the view vertically; double-click shows the whole
 * range. Ctrl/Cmd + wheel (or pinch) over it zooms vertically (see useWheelZoomScroll).
 */
export function BpmAxis({ viewport, bounds, scrollYTo, zoomYToFit }: Props) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, dpr }: CanvasSize) => {
      const major = cssVar(ctx.canvas, '--tl-ruler-bar')
      const minor = cssVar(ctx.canvas, '--tl-ruler-beat')
      ctx.font = `${11 * dpr}px ${cssVar(ctx.canvas, '--tl-font') || 'sans-serif'}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const right = Math.round(width * dpr)
      const lineW = Math.max(1, Math.round(dpr))
      for (const tick of visibleBpmTicks(viewport, bounds)) {
        const y = Math.round(tick.y * dpr)
        ctx.fillStyle = tick.major ? major : minor
        const len = Math.round((tick.major ? 6 : 3) * dpr)
        ctx.fillRect(right - len, y, len, lineW)
        ctx.fillText(String(tick.bpm), right - Math.round(9 * dpr), y)
      }
    },
    [viewport, bounds],
  )
  const ref = useCanvas(draw)

  const drag = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startScroll: viewport.scrollY }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    // Grab-and-move: content follows the pointer.
    scrollYTo(d.startScroll - (e.clientY - d.startY))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  return (
    <div
      className="tl-yaxis"
      title="BPM — drag to scroll, Ctrl+wheel to stretch, double-click to fit"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={zoomYToFit}
    >
      <canvas ref={ref} className="tl-yaxis-canvas" aria-hidden />
    </div>
  )
}
