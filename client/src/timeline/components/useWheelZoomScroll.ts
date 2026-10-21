import { useEffect, useRef, type RefObject } from 'react'
import type { ViewportActions } from '../state/TimelineProvider'

/** Zoom factor per pixel of wheel delta; ~100px mouse notch ≈ 26%. */
const ZOOM_SENSITIVITY = 0.003
const LINE_HEIGHT_PX = 16

/**
 * Wheel → scroll/zoom, coalesced to one update per animation frame.
 * - Ctrl/Cmd + wheel (and trackpad pinch, which browsers report as ctrl+wheel): zoom around the cursor.
 * - Horizontal wheel / trackpad swipe, or Shift + wheel: horizontal scroll.
 * - Vertical wheel: scrolls tracks vertically if they overflow, otherwise horizontally.
 *
 * `rootRef` receives the events; `lanesRef` is the lane area that x=0 is measured from;
 * `bodyRef` is the vertical scroller.
 */
export function useWheelZoomScroll(
  rootRef: RefObject<HTMLElement | null>,
  lanesRef: RefObject<HTMLElement | null>,
  bodyRef: RefObject<HTMLElement | null>,
  actions: ViewportActions,
) {
  const pending = useRef({ dx: 0, zoom: 1, anchorX: 0 })
  const frame = useRef(0)

  useEffect(() => {
    const root = rootRef.current!

    const flush = () => {
      frame.current = 0
      const { dx, zoom, anchorX } = pending.current
      pending.current = { dx: 0, zoom: 1, anchorX }
      // Both dispatches land in one React render (automatic batching).
      if (zoom !== 1) actions.zoomAt(zoom, anchorX)
      if (dx !== 0) actions.scrollBy(dx)
    }
    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(flush)
    }

    const onWheel = (e: WheelEvent) => {
      const lanes = lanesRef.current!
      const unit = e.deltaMode === 1 ? LINE_HEIGHT_PX : e.deltaMode === 2 ? lanes.clientWidth : 1
      const deltaX = e.deltaX * unit
      const deltaY = e.deltaY * unit

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const rect = lanes.getBoundingClientRect()
        pending.current.anchorX = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
        pending.current.zoom *= Math.exp(-deltaY * ZOOM_SENSITIVITY)
        schedule()
        return
      }

      const body = bodyRef.current!
      const canScrollVertically = body.scrollHeight > body.clientHeight
      let dx = deltaX
      if (dx === 0 && (e.shiftKey || !canScrollVertically)) dx = deltaY
      if (dx === 0) return // plain vertical wheel: let the body scroll natively

      e.preventDefault()
      pending.current.dx += dx
      schedule()
    }

    // passive: false so preventDefault can stop page zoom / back-swipe navigation.
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      root.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [rootRef, lanesRef, bodyRef, actions])
}
