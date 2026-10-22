import { memo, type CSSProperties } from 'react'
import type { Track } from '../model/types'

type Props = {
  track: Track
  /** Opens the edit dialog for this track. Pass a stable function so the memo holds. */
  onEdit?: (trackId: string) => void
}

/** Mute/solo/arm controls go here once there's an audio engine. */
export const TrackHeader = memo(function TrackHeader({ track, onEdit }: Props) {
  return (
    <div className="tl-track-header" style={{ '--tl-line-color': track.color } as CSSProperties}>
      <span className="tl-track-swatch" aria-hidden="true" />
      <span className="tl-track-name">{track.name}</span>
      {track.channel !== undefined && (
        <span className="tl-track-channel" title={`Channel ${track.channel}`} aria-label={`Channel ${track.channel}`}>
          CH {track.channel}
        </span>
      )}
      {onEdit && (
        <button
          type="button"
          className="tl-track-edit"
          onClick={() => onEdit(track.id)}
          title={`Edit ${track.name}`}
          aria-label={`Edit ${track.name}`}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">✎</span>
        </button>
      )}
    </div>
  )
})
