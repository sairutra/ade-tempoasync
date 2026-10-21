import { memo } from 'react'
import type { Clip as ClipModel } from '../model/types'
import { timeToContentX } from '../viewport/viewport'

type Props = { clip: ClipModel; pxPerSecond: number }

/**
 * Re-renders only when its clip or the zoom level changes — never on scroll.
 * Milestone 3 adds pointer handlers for drag/trim here; waveforms render inside.
 */
export const Clip = memo(function Clip({ clip, pxPerSecond }: Props) {
  const x = timeToContentX(clip.start, pxPerSecond)
  const width = Math.max(1, clip.duration * pxPerSecond)
  return (
    <div
      className="tl-clip"
      style={{ transform: `translateX(${x}px)`, width, backgroundColor: clip.color }}
      title={clip.name}
    >
      <span className="tl-clip-name">{clip.name}</span>
    </div>
  )
})
