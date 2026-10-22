import { useEffect, useRef } from 'react'
import { stepToTime } from '../model/tempo'
import { useTransportClock } from '../state/TimelineProvider'
import { timeToContentX, timeToX, type Viewport } from '../viewport/viewport'

type Props = {
  viewport: Viewport
  viewWidth: number
  bpm: number
  scrollTo: (scrollX: number) => void
}

/**
 * Vertical playhead over the ruler and lanes. Its x is written imperatively from the clock's
 * frame callback (`timeToX(stepToTime(step))`), so playback never re-renders React.
 * Re-subscribing on viewport changes redraws it immediately on scroll/zoom.
 *
 * While playing it also pages the view: when the playhead crosses the right edge, the view
 * scrolls so the playhead sits at the left edge. Only a crossing triggers it, so the user can
 * scroll away during playback without being pulled back.
 */
export function Playhead({ viewport, viewWidth, bpm, scrollTo }: Props) {
  const clock = useTransportClock()
  const ref = useRef<HTMLDivElement>(null)
  /** Playhead content x on the previous frame, kept across re-subscriptions. */
  const prevContentX = useRef<number | null>(null)

  useEffect(
    () =>
      clock.onFrame((step, playing) => {
        const time = stepToTime(step, bpm)
        const x = timeToX(time, viewport)
        const el = ref.current!
        el.style.transform = `translateX(${Math.round(x)}px)`
        el.style.visibility = x < -1 || x > viewWidth + 1 ? 'hidden' : 'visible'

        const contentX = timeToContentX(time, viewport.pxPerSecond)
        const rightEdge = viewport.scrollX + viewWidth
        const prev = prevContentX.current
        prevContentX.current = contentX
        if (playing && viewWidth > 0 && prev !== null && prev <= rightEdge && contentX > rightEdge) scrollTo(contentX)
      }),
    [clock, viewport, viewWidth, bpm, scrollTo],
  )

  // Starting playback with the playhead off screen brings it into view.
  useEffect(() => {
    let wasPlaying = clock.getState().playing
    return clock.subscribe(() => {
      const playing = clock.getState().playing
      if (playing && !wasPlaying) {
        const x = timeToX(stepToTime(clock.getPosition(), bpm), viewport)
        if (x < 0 || x > viewWidth) scrollTo(viewport.scrollX + x)
      }
      wasPlaying = playing
    })
  }, [clock, viewport, viewWidth, bpm, scrollTo])

  return (
    <div className="tl-playhead-layer" aria-hidden>
      <div ref={ref} className="tl-playhead" />
    </div>
  )
}
