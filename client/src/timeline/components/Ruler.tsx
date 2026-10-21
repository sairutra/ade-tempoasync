import { useCallback } from 'react'
import { formatTime, pickTickScale, visibleTicks } from '../viewport/ticks'
import type { Viewport } from '../viewport/viewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

/** Minor ticks closer than this (CSS px) are skipped. */
const MIN_MINOR_SPACING_PX = 5

export function Ruler({ viewport }: { viewport: Viewport }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, height, dpr }: CanvasSize) => {
      const canvas = ctx.canvas
      const scale = pickTickScale(viewport.pxPerSecond)
      const showMinor = scale.minor * viewport.pxPerSecond >= MIN_MINOR_SPACING_PX
      const h = Math.round(height * dpr)

      ctx.fillStyle = cssVar(canvas, '--tl-ruler-tick')
      ctx.font = `${11 * dpr}px ${cssVar(canvas, '--tl-font')}`
      ctx.textBaseline = 'top'

      for (const tick of visibleTicks(viewport, width, scale)) {
        if (!tick.major && !showMinor) continue
        const x = Math.round(tick.x * dpr)
        const tickH = Math.round((tick.major ? 0.5 : 0.25) * h)
        ctx.fillRect(x, h - tickH, Math.max(1, Math.round(dpr)), tickH)
        if (tick.major) ctx.fillText(formatTime(tick.time, scale.major), x + 4 * dpr, 4 * dpr)
      }

      ctx.fillStyle = cssVar(canvas, '--tl-border')
      ctx.fillRect(0, h - Math.round(dpr), Math.round(width * dpr), Math.round(dpr))
    },
    [viewport],
  )

  const ref = useCanvas(draw)
  return <canvas ref={ref} className="tl-ruler" aria-hidden />
}
