import { memo } from 'react'
import { clipEnd } from '../model/selectors'
import type { Clip as ClipModel, Track } from '../model/types'
import { Clip } from './Clip'

type Props = {
  track: Track
  clips: Record<string, ClipModel>
  pxPerSecond: number
  /** Visible time range (s), already widened by overscan. */
  visibleStart: number
  visibleEnd: number
}

export const TrackLane = memo(function TrackLane({ track, clips, pxPerSecond, visibleStart, visibleEnd }: Props) {
  return (
    <div className="tl-lane">
      {track.clipIds.map((id) => {
        const clip = clips[id]
        if (clip.start > visibleEnd || clipEnd(clip) < visibleStart) return null
        return <Clip key={id} clip={clip} pxPerSecond={pxPerSecond} />
      })}
    </div>
  )
})
