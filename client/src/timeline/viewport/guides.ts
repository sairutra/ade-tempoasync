import { timeToX, type Viewport } from './viewport'

/**
 * Selection guides: faint full-height vertical lines at given times (seconds), drawn on a canvas
 * already scaled to device pixels. Only the visible ones are drawn.
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  times: readonly number[],
  viewport: Viewport,
  width: number,
  height: number,
  dpr: number,
  color: string,
): void {
  const lineW = Math.max(1, Math.round(dpr))
  ctx.fillStyle = color
  for (const t of times) {
    const x = timeToX(t, viewport)
    if (x < -1 || x > width + 1) continue
    ctx.fillRect(Math.round(x * dpr), 0, lineW, Math.round(height * dpr))
  }
}
