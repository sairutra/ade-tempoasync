import { useCallback } from 'react'
import { pickTickScale, visibleTicks } from '../viewport/ticks'
import type { Viewport } from '../viewport/viewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

const MIN_MINOR_SPACING_PX = 12

/** Vertical grid lines behind all lanes, aligned with the ruler's ticks. */
export function GridCanvas({ viewport }: { viewport: Viewport }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, height, dpr }: CanvasSize) => {
      const scale = pickTickScale(viewport.pxPerSecond)
      const showMinor = scale.minor * viewport.pxPerSecond >= MIN_MINOR_SPACING_PX
      const major = cssVar(ctx.canvas, '--tl-grid-major')
      const minor = cssVar(ctx.canvas, '--tl-grid-minor')
      const h = Math.round(height * dpr)
      const lineW = Math.max(1, Math.round(dpr))

      for (const tick of visibleTicks(viewport, width, scale)) {
        if (!tick.major && !showMinor) continue
        ctx.fillStyle = tick.major ? major : minor
        ctx.fillRect(Math.round(tick.x * dpr), 0, lineW, h)
      }
    },
    [viewport],
  )

  const ref = useCanvas(draw)
  return <canvas ref={ref} className="tl-grid" aria-hidden />
}
