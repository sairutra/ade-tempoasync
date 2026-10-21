import { memo, type CSSProperties } from 'react'
import type { Track } from '../model/types'

/** Mute/solo/arm controls go here once there's an audio engine. */
export const TrackHeader = memo(function TrackHeader({ track }: { track: Track }) {
  return (
    <div className="tl-track-header" style={{ '--tl-line-color': track.color } as CSSProperties}>
      <span className="tl-track-swatch" aria-hidden="true" />
      <span className="tl-track-name">{track.name}</span>
    </div>
  )
})
