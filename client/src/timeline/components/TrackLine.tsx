import { memo, type CSSProperties } from 'react'
import type { Track } from '../model/types'
import { timeToContentX } from '../viewport/viewport'

type Props = { track: Track; pxPerSecond: number }

/**
 * One line per track, placed anywhere in the lane area: x from time, y from the track's 0–1 fraction.
 * Re-renders only when its track or the zoom level changes — never on scroll.
 */
export const TrackLine = memo(function TrackLine({ track, pxPerSecond }: Props) {
  const x = timeToContentX(track.start, pxPerSecond)
  const width = Math.max(1, track.duration * pxPerSecond)
  return (
    <div
      className="tl-line"
      style={{
        top: `${track.y * 100}%`,
        transform: `translate(${x}px, -50%)`,
        width,
        '--tl-line-color': track.color,
      } as CSSProperties}
      title={track.name}
    >
      <span className="tl-line-name">{track.name}</span>
    </div>
  )
})
