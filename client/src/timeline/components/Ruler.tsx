import { useCallback } from 'react'
import {
  RULER_MIN_MINOR_SPACING_PX,
  formatStep,
  pickTickScale,
  pxPerStep,
  visibleTicks,
  type TickLevel,
} from '../viewport/ticks'
import type { Viewport } from '../viewport/viewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

/** Tick height as a fraction of the ruler height: bars tallest, 16ths shortest. */
const TICK_HEIGHT: Record<TickLevel, number> = { bar: 0.6, beat: 0.4, step: 0.22 }

export function Ruler({ viewport, bpm }: { viewport: Viewport; bpm: number }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, height, dpr }: CanvasSize) => {
      const canvas = ctx.canvas
      const scale = pickTickScale(pxPerStep(viewport.pxPerSecond, bpm), RULER_MIN_MINOR_SPACING_PX)
      const colors: Record<TickLevel, string> = {
        bar: cssVar(canvas, '--tl-ruler-bar'),
        beat: cssVar(canvas, '--tl-ruler-beat'),
        step: cssVar(canvas, '--tl-ruler-step'),
      }
      const h = Math.round(height * dpr)
      const lineW = Math.max(1, Math.round(dpr))

      ctx.font = `${11 * dpr}px ${cssVar(canvas, '--tl-font')}`
      ctx.textBaseline = 'top'

      for (const tick of visibleTicks(viewport, width, scale, bpm)) {
        const x = Math.round(tick.x * dpr)
        const tickH = Math.round(TICK_HEIGHT[tick.level] * h)
        ctx.fillStyle = colors[tick.level]
        ctx.fillRect(x, h - tickH, lineW, tickH)
        if (tick.major) {
          ctx.fillStyle = colors.bar
          ctx.fillText(formatStep(tick.step, scale.major), x + 4 * dpr, 4 * dpr)
        }
      }

      ctx.fillStyle = cssVar(canvas, '--tl-border')
      ctx.fillRect(0, h - Math.round(dpr), Math.round(width * dpr), Math.round(dpr))
    },
    [viewport, bpm],
  )

  const ref = useCanvas(draw)
  return <canvas ref={ref} className="tl-ruler" aria-hidden />
}
