/**
 * The single time <-> pixel transform. Pure functions only, no React.
 * x is measured in CSS pixels from the left edge of the visible lane area.
 */
export type Viewport = { pxPerSecond: number; scrollX: number }

/** What clamping needs to know: visible width (px) and scrollable length (s). */
export type ViewportBounds = { viewWidth: number; duration: number }

export const MIN_PX_PER_SECOND = 2
export const MAX_PX_PER_SECOND = 2000

export function timeToX(t: number, v: Viewport): number {
  return timeToContentX(t, v.pxPerSecond) - v.scrollX
}

/**
 * x inside the scrolled content layer (before subtracting scrollX). Clips are placed with this
 * and the layer is translated by -scrollX, so the composition is exactly timeToX — but a scroll
 * only changes one transform instead of every clip.
 */
export function timeToContentX(t: number, pxPerSecond: number): number {
  return t * pxPerSecond
}

export function xToTime(x: number, v: Viewport): number {
  return (x + v.scrollX) / v.pxPerSecond
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function clampPxPerSecond(pxPerSecond: number): number {
  return clamp(pxPerSecond, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND)
}

/** Full width of the timeline at a zoom level, in px. */
export function contentWidth(pxPerSecond: number, b: ViewportBounds): number {
  return b.duration * pxPerSecond
}

export function maxScrollX(pxPerSecond: number, b: ViewportBounds): number {
  return Math.max(0, contentWidth(pxPerSecond, b) - b.viewWidth)
}

/** Clamps zoom and scroll. Returns the same object when nothing changed, so React can bail out. */
export function clampViewport(v: Viewport, b: ViewportBounds): Viewport {
  const pxPerSecond = clampPxPerSecond(v.pxPerSecond)
  const scrollX = clamp(v.scrollX, 0, maxScrollX(pxPerSecond, b))
  return pxPerSecond === v.pxPerSecond && scrollX === v.scrollX ? v : { pxPerSecond, scrollX }
}

/** Returns `prev` when `next` is equal, so no-op updates (e.g. scrolling at an edge) don't re-render. */
function keepIfEqual(prev: Viewport, next: Viewport): Viewport {
  return prev.pxPerSecond === next.pxPerSecond && prev.scrollX === next.scrollX ? prev : next
}

export function scrollTo(v: Viewport, scrollX: number, b: ViewportBounds): Viewport {
  return keepIfEqual(v, clampViewport({ ...v, scrollX }, b))
}

export function scrollBy(v: Viewport, dx: number, b: ViewportBounds): Viewport {
  return scrollTo(v, v.scrollX + dx, b)
}

/**
 * Zooms by `factor` keeping the time under `anchorX` fixed on screen:
 * solve timeToX(anchorTime, v') === anchorX for scrollX.
 */
export function zoomAt(v: Viewport, factor: number, anchorX: number, b: ViewportBounds): Viewport {
  const anchorTime = xToTime(anchorX, v)
  const pxPerSecond = clampPxPerSecond(v.pxPerSecond * factor)
  return keepIfEqual(v, clampViewport({ pxPerSecond, scrollX: anchorTime * pxPerSecond - anchorX }, b))
}

/** Fits the whole duration into the view. */
export function zoomToFit(b: ViewportBounds): Viewport {
  const pxPerSecond = b.viewWidth > 0 && b.duration > 0 ? b.viewWidth / b.duration : MIN_PX_PER_SECOND
  return clampViewport({ pxPerSecond, scrollX: 0 }, b)
}

/** [start, end] in seconds, widened by `overscanPx` on each side. */
export function visibleTimeRange(v: Viewport, viewWidth: number, overscanPx = 0): [number, number] {
  return [xToTime(-overscanPx, v), xToTime(viewWidth + overscanPx, v)]
}
