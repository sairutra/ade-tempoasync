import { useEffect, useRef, type RefObject } from 'react'
import type { ViewportActions } from '../state/TimelineProvider'

/** Zoom factor per pixel of wheel delta; ~100px mouse notch ≈ 26%. */
const ZOOM_SENSITIVITY = 0.003
const LINE_HEIGHT_PX = 16

type Refs = {
  /** Receives the wheel events. */
  root: RefObject<HTMLElement | null>
  /** The visible lane area: x = 0 and y = 0 are measured from its top-left corner. */
  lanes: RefObject<HTMLElement | null>
  /** The BPM axis: Ctrl/Cmd + wheel over it zooms vertically instead of horizontally. */
  axis: RefObject<HTMLElement | null>
  /** The track header column: it scrolls natively, so wheel events over it are left alone. */
  headers: RefObject<HTMLElement | null>
  /** Whether the BPM range is taller than the view (read at event time, so no re-subscribe). */
  canScrollY: RefObject<boolean>
}

/**
 * Wheel → scroll/zoom, coalesced to one update per animation frame.
 * - Ctrl/Cmd + wheel (and trackpad pinch, which browsers report as ctrl+wheel): zoom time around
 *   the cursor; over the BPM axis it stretches the BPM axis around the cursor instead.
 * - Alt + wheel: stretch the BPM axis around the cursor, anywhere.
 * - Horizontal wheel / trackpad swipe, or Shift + wheel: horizontal scroll.
 * - Vertical wheel: scrolls the BPM axis when it's stretched past the view, otherwise horizontally.
 */
export function useWheelZoomScroll(refs: Refs, actions: ViewportActions) {
  const pending = useRef({ dx: 0, dy: 0, zoomX: 1, zoomY: 1, anchorX: 0, anchorY: 0 })
  const frame = useRef(0)
  const { root: rootRef, lanes: lanesRef, axis: axisRef, headers: headersRef, canScrollY } = refs

  useEffect(() => {
    const root = rootRef.current!

    const flush = () => {
      frame.current = 0
      const { dx, dy, zoomX, zoomY, anchorX, anchorY } = pending.current
      pending.current = { dx: 0, dy: 0, zoomX: 1, zoomY: 1, anchorX, anchorY }
      // All dispatches land in one React render (automatic batching).
      if (zoomX !== 1) actions.zoomAt(zoomX, anchorX)
      if (zoomY !== 1) actions.zoomYAt(zoomY, anchorY)
      if (dx !== 0) actions.scrollBy(dx)
      if (dy !== 0) actions.scrollYBy(dy)
    }
    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(flush)
    }

    const onWheel = (e: WheelEvent) => {
      const target = e.target as Node | null
      if (target && headersRef.current?.contains(target)) return // native header scrolling

      const lanes = lanesRef.current!
      const rect = lanes.getBoundingClientRect()
      const unit = e.deltaMode === 1 ? LINE_HEIGHT_PX : e.deltaMode === 2 ? lanes.clientWidth : 1
      const deltaX = e.deltaX * unit
      const deltaY = e.deltaY * unit
      const overAxis = !!target && !!axisRef.current?.contains(target)

      if (e.altKey || ((e.ctrlKey || e.metaKey) && overAxis)) {
        e.preventDefault()
        pending.current.anchorY = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
        // Some browsers report Alt/Shift+wheel on the x delta; either direction stretches.
        pending.current.zoomY *= Math.exp(-(deltaY || deltaX) * ZOOM_SENSITIVITY)
        schedule()
        return
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        pending.current.anchorX = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
        pending.current.zoomX *= Math.exp(-deltaY * ZOOM_SENSITIVITY)
        schedule()
        return
      }

      let dx = deltaX
      let dy = 0
      if (dx === 0 && (e.shiftKey || !canScrollY.current)) dx = deltaY
      else if (!e.shiftKey) dy = deltaY
      if (dx === 0 && dy === 0) return

      e.preventDefault()
      pending.current.dx += dx
      pending.current.dy += dy
      schedule()
    }

    // passive: false so preventDefault can stop page zoom / back-swipe navigation.
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      root.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [rootRef, lanesRef, axisRef, headersRef, canScrollY, actions])
}
