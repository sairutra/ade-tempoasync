import { useCallback } from 'react'
import { bpmToY, visibleBpmTicks, type BpmBounds, type BpmViewport } from '../viewport/bpmViewport'
import { GRID_MIN_MINOR_SPACING_PX, pickTickScale, pxPerStep, visibleTicks, type TickLevel } from '../viewport/ticks'
import { drawGuides } from '../viewport/guides'
import type { Viewport } from '../viewport/viewport'
import { cssVar, useCanvas, type CanvasSize } from './useCanvas'

type Props = {
  viewport: Viewport
  bpm: number
  bpmViewport: BpmViewport
  bpmBounds: BpmBounds
  /** Times (s) of the selected line's downbeats, drawn as full-height guides; null for none. */
  guideTimes?: readonly number[] | null
}

/**
 * Grid behind the lines: vertical lines aligned with the ruler's ticks, horizontal lines aligned
 * with the BPM axis labels. Vertical lines only span the BPM range, so the padding above bpmMax
 * and below bpmMin reads as "outside the range".
 */
export function GridCanvas({ viewport, bpm, bpmViewport, bpmBounds, guideTimes = null }: Props) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { width, height, dpr }: CanvasSize) => {
      const scale = pickTickScale(pxPerStep(viewport.pxPerSecond, bpm), GRID_MIN_MINOR_SPACING_PX)
      const colors: Record<TickLevel, string> = {
        bar: cssVar(ctx.canvas, '--tl-grid-bar'),
        beat: cssVar(ctx.canvas, '--tl-grid-beat'),
        step: cssVar(ctx.canvas, '--tl-grid-step'),
      }
      const lineW = Math.max(1, Math.round(dpr))
      const top = Math.max(0, Math.round(bpmToY(bpmBounds.bpmMax, bpmViewport, bpmBounds) * dpr))
      const bottom = Math.min(Math.round(height * dpr), Math.round(bpmToY(bpmBounds.bpmMin, bpmViewport, bpmBounds) * dpr))
      // Guides span the whole lane height, so they're drawn before the range check below.
      if (guideTimes) drawGuides(ctx, guideTimes, viewport, width, height, dpr, cssVar(ctx.canvas, '--tl-guide'))
      if (bottom <= top) return

      for (const tick of visibleTicks(viewport, width, scale, bpm)) {
        ctx.fillStyle = colors[tick.level]
        ctx.fillRect(Math.round(tick.x * dpr), top, lineW, bottom - top + lineW)
      }

      const w = Math.round(width * dpr)
      for (const tick of visibleBpmTicks(bpmViewport, bpmBounds)) {
        ctx.fillStyle = tick.major ? colors.beat : colors.step
        ctx.fillRect(0, Math.round(tick.y * dpr), w, lineW)
      }
    },
    [viewport, bpm, bpmViewport, bpmBounds, guideTimes],
  )

  const ref = useCanvas(draw)
  return <canvas ref={ref} className="tl-grid" aria-hidden />
}
