import { useLayoutEffect, useRef, useState } from 'react'

export type CanvasSize = { width: number; height: number; dpr: number }

/**
 * Sizes a canvas's backing store to its CSS box × devicePixelRatio and calls `draw`
 * whenever the box, the DPR (e.g. window moved to another monitor) or `draw` changes.
 * `draw` works in device pixels: use Math.round(x * dpr) for crisp 1px lines.
 */
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, size: CanvasSize) => void) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, dpr: 1 })

  useLayoutEffect(() => {
    const canvas = ref.current!
    const measure = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      setSize((s) => (s.width === width && s.height === height && s.dpr === dpr ? s : { width, height, dpr }))
    }

    const observer = new ResizeObserver(measure)
    observer.observe(canvas)

    // ResizeObserver doesn't fire on DPR changes; a resolution media query does.
    let mq: MediaQueryList | undefined
    const watchDpr = () => {
      mq?.removeEventListener('change', onDprChange)
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      mq.addEventListener('change', onDprChange)
    }
    const onDprChange = () => {
      measure()
      watchDpr()
    }
    watchDpr()
    measure()

    return () => {
      observer.disconnect()
      mq?.removeEventListener('change', onDprChange)
    }
  }, [])

  useLayoutEffect(() => {
    const canvas = ref.current!
    const w = Math.round(size.width * size.dpr)
    const h = Math.round(size.height * size.dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (!ctx || w === 0 || h === 0) return
    ctx.clearRect(0, 0, w, h)
    draw(ctx, size)
  }, [draw, size])

  return ref
}

/** Reads a CSS custom property so canvas colors stay themeable from CSS. */
export function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}
