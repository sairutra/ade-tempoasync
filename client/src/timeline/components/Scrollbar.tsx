import { useLayoutEffect, useRef } from 'react'

type Props = {
  scrollX: number
  contentWidth: number
  onScroll: (scrollX: number) => void
}

/**
 * Native horizontal scrollbar mirroring viewport.scrollX. The viewport stays the single
 * source of truth: this element only reports user drags and follows programmatic changes.
 */
export function Scrollbar({ scrollX, contentWidth, onScroll }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastSet = useRef(-1)

  useLayoutEffect(() => {
    const el = ref.current!
    if (Math.abs(el.scrollLeft - scrollX) >= 1) {
      el.scrollLeft = scrollX
      lastSet.current = el.scrollLeft
    }
  }, [scrollX, contentWidth])

  return (
    <div
      ref={ref}
      className="tl-scrollbar"
      onScroll={(e) => {
        const left = e.currentTarget.scrollLeft
        // Ignore the echo of our own programmatic scrollLeft assignment.
        if (Math.abs(left - lastSet.current) < 1) return
        lastSet.current = -1
        onScroll(left)
      }}
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  )
}
