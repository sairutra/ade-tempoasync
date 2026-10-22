import { useEffect, useRef } from 'react'
import { formatBarBeatStep, formatClock } from '../playback/format'
import { useIsPlaying, useTransportClock } from '../state/TimelineProvider'

/**
 * Play/pause, stop, and the playhead position. Re-renders only on play/pause;
 * the position readout is written imperatively every frame.
 */
type Props = {
  bpm: number
  /** Sync view: lines drawn at real time (see TrackLine). Omit both to hide the toggle. */
  syncView?: boolean
  onToggleSyncView?: () => void
}

export function TransportBar({ bpm, syncView = false, onToggleSyncView }: Props) {
  const clock = useTransportClock()
  const playing = useIsPlaying()
  const barsRef = useRef<HTMLSpanElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(
    () =>
      clock.onFrame((step) => {
        barsRef.current!.textContent = formatBarBeatStep(step)
        clockRef.current!.textContent = formatClock(step, bpm)
      }),
    [clock, bpm],
  )

  return (
    <div className="tl-transport" role="toolbar" aria-label="Transport">
      <button
        type="button"
        className="tl-transport-btn"
        onClick={clock.toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        data-active={playing || undefined}
      >
        <svg viewBox="0 0 12 12" aria-hidden>
          {playing ? <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /> : <path d="M3 1.2v9.6L10.6 6z" />}
        </svg>
      </button>
      <button type="button" className="tl-transport-btn" onClick={clock.stop} aria-label="Stop" title="Stop (return to start)">
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M2 2h8v8H2z" />
        </svg>
      </button>
      <span className="tl-transport-pos" aria-label="Position (bar.beat.16th)" ref={barsRef} />
      <span className="tl-transport-time" ref={clockRef} />
      <span className="tl-transport-bpm">{bpm} BPM</span>
      {onToggleSyncView && (
        <button
          type="button"
          className="tl-transport-view"
          onClick={onToggleSyncView}
          aria-pressed={syncView}
          title={
            syncView
              ? 'Sync view: lines at the real time each step sounds. Click for the step view.'
              : 'Step view: point i drawn at project step i. Click for the sync view (real time).'
          }
        >
          {syncView ? 'X: time' : 'X: steps'}
        </button>
      )}
    </div>
  )
}
