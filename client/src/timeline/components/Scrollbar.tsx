import { useLayoutEffect, useRef } from 'react'

type Props = {
  /** 'x' (default): horizontal bar mirroring viewport.scrollX; 'y': vertical bar for the BPM axis. */
  axis?: 'x' | 'y'
  /** Current scroll offset along `axis`, in px. */
  scroll: number
  /** Full scrollable length along `axis`, in px. */
  contentSize: number
  onScroll: (scroll: number) => void
  label?: string
}

/**
 * Native scrollbar mirroring a viewport scroll offset. The viewport stays the single
 * source of truth: this element only reports user drags and follows programmatic changes.
 */
export function Scrollbar({ axis = 'x', scroll, contentSize, onScroll, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastSet = useRef(-1)
  const key = axis === 'x' ? 'scrollLeft' : 'scrollTop'

  useLayoutEffect(() => {
    const el = ref.current!
    if (Math.abs(el[key] - scroll) >= 1) {
      el[key] = scroll
      lastSet.current = el[key]
    }
  }, [key, scroll, contentSize])

  return (
    <div
      ref={ref}
      className={axis === 'x' ? 'tl-scrollbar' : 'tl-scrollbar tl-scrollbar-y'}
      aria-label={label}
      onScroll={(e) => {
        const pos = e.currentTarget[key]
        // Ignore the echo of our own programmatic assignment.
        if (Math.abs(pos - lastSet.current) < 1) return
        lastSet.current = -1
        onScroll(pos)
      }}
    >
      <div style={axis === 'x' ? { width: contentSize, height: 1 } : { width: 1, height: contentSize }} />
    </div>
  )
}
