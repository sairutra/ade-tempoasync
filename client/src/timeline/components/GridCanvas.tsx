import { useCallback } from 'react'
import { GRID_MIN_MINOR_SPACING_PX, pickTickScale, pxPerStep, visibleTicks, type TickLevel } from '../viewport/ticks'
import type { Viewport } from '../viewport/viewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

/** Vertical grid lines behind all lanes, aligned with the ruler's ticks. */
export function GridCanvas({ viewport, bpm }: { viewport: Viewport; bpm: number }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, height, dpr }: CanvasSize) => {
      const scale = pickTickScale(pxPerStep(viewport.pxPerSecond, bpm), GRID_MIN_MINOR_SPACING_PX)
      const colors: Record<TickLevel, string> = {
        bar: cssVar(ctx.canvas, '--tl-grid-bar'),
        beat: cssVar(ctx.canvas, '--tl-grid-beat'),
        step: cssVar(ctx.canvas, '--tl-grid-step'),
      }
      const h = Math.round(height * dpr)
      const lineW = Math.max(1, Math.round(dpr))

      for (const tick of visibleTicks(viewport, width, scale, bpm)) {
        ctx.fillStyle = colors[tick.level]
        ctx.fillRect(Math.round(tick.x * dpr), 0, lineW, h)
      }
    },
    [viewport, bpm],
  )

  const ref = useCanvas(draw)
  return <canvas ref={ref} className="tl-grid" aria-hidden />
}
