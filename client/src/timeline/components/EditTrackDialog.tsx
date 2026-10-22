import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { TrackEdit } from '../model/editReducer'
import { DEFAULT_SEQUENCE, sequenceFromSlots, slotsFromSequence } from '../model/sequence'
import type { Track } from '../model/types'
import { SequenceInput } from './SequenceInput'

type Props = {
  /** The track being edited; null keeps the dialog closed. */
  track: Track | null
  onSubmit: (trackId: string, changes: TrackEdit) => void
  onClose: () => void
}

/**
 * Modal form for an existing track. Name, colour and channel are shown read-only for now; only the
 * MIDI sequence can be changed. A track loaded without a sequence starts from the default pattern.
 * Same <dialog> handling as AddChannelDialog.
 */
export function EditTrackDialog({ track, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [slots, setSlots] = useState(() => slotsFromSequence(DEFAULT_SEQUENCE))
  const open = track !== null
  const trackId = track?.id

  // Load the track's sequence each time the dialog opens (or switches to another track).
  useEffect(() => {
    const dialog = dialogRef.current!
    if (track) {
      setSlots(slotsFromSequence(track.sequence ?? DEFAULT_SEQUENCE))
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
    // Only on open/close or a different track: edits elsewhere must not wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trackId])

  const sequence = sequenceFromSlots(slots)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!track || sequence === null) return
    onSubmit(track.id, { sequence })
  }

  return (
    <dialog
      ref={dialogRef}
      className="tl-dialog"
      aria-labelledby={`${ids}-title`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {track && (
        <form className="tl-dialog-form" onSubmit={submit} noValidate>
          <h2 id={`${ids}-title`} className="tl-dialog-title">Edit channel</h2>

          <dl className="tl-track-summary">
            <dt>Name</dt>
            <dd>
              <span className="tl-color-swatch" style={{ background: track.color }} aria-hidden="true" />
              {track.name}
            </dd>
            {track.channel !== undefined && (
              <>
                <dt>Channel</dt>
                <dd>{track.channel}</dd>
              </>
            )}
          </dl>

          <SequenceInput slots={slots} onChange={setSlots} />

          <div className="tl-dialog-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="tl-btn-primary" disabled={sequence === null}>Save</button>
          </div>
        </form>
      )}
    </dialog>
  )
}
