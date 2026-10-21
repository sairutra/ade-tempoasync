import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { distinctColor, normalizeHex, suggestColor } from '../model/colors'
import type { NewTrackInput } from '../model/newTrack'

export const CHANNEL_BPM_MIN = 1
export const CHANNEL_BPM_MAX = 999

type Props = {
  open: boolean
  /** Colours of the existing tracks: the picked colour must differ from these. */
  usedColors: readonly string[]
  /** Prefilled BPM (the project BPM). */
  defaultBpm: number
  onSubmit: (channel: Omit<NewTrackInput, 'startStep'>) => void
  onClose: () => void
}

/**
 * Modal form for a new channel: name, colour and BPM. A colour already used by another track is
 * shown (and saved) as a slightly different shade, so every line stays distinguishable.
 * Uses <dialog>.showModal(): focus trap, Escape and the backdrop come from the browser.
 */
export function AddChannelDialog({ open, usedColors, defaultBpm, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#e07a5f')
  const [bpm, setBpm] = useState(String(defaultBpm))

  // Reset the form each time it opens, with a colour nobody uses yet.
  useEffect(() => {
    const dialog = dialogRef.current!
    if (open && !dialog.open) {
      setName('')
      setColor(suggestColor(usedColors))
      setBpm(String(defaultBpm))
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
    // Only on open/close: usedColors changing while open must not wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hex = normalizeHex(color) ?? '#000000'
  const finalColor = distinctColor(hex, usedColors)
  const adjusted = finalColor !== hex

  const bpmValue = Number(bpm)
  const bpmValid = bpm.trim() !== '' && Number.isFinite(bpmValue) && bpmValue >= CHANNEL_BPM_MIN && bpmValue <= CHANNEL_BPM_MAX
  const nameValid = name.trim() !== ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!nameValid || !bpmValid) return
    onSubmit({ name: name.trim(), color: finalColor, bpm: bpmValue })
  }

  return (
    <dialog
      ref={dialogRef}
      className="tl-dialog"
      aria-labelledby={`${ids}-title`}
      // Escape (or form method=dialog) closes natively; keep React state in sync.
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Click on the backdrop (the dialog element itself, outside the form) closes.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form className="tl-dialog-form" onSubmit={submit} noValidate>
        <h2 id={`${ids}-title`} className="tl-dialog-title">Add channel</h2>

        <label className="tl-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Synth"
            maxLength={40}
            autoFocus
            required
          />
        </label>

        <div className="tl-field">
          <label htmlFor={`${ids}-color`}>Colour</label>
          <div className="tl-color-row">
            <input id={`${ids}-color`} type="color" value={hex} onChange={(e) => setColor(e.target.value)} />
            <span className="tl-color-swatch" style={{ background: finalColor }} aria-hidden="true" />
            <code>{finalColor}</code>
          </div>
          {adjusted && (
            <p className="tl-field-hint" role="status">
              That colour is already in use, so this channel gets a slightly different shade.
            </p>
          )}
        </div>

        <label className="tl-field">
          <span>BPM</span>
          <input
            type="number"
            inputMode="decimal"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            min={CHANNEL_BPM_MIN}
            max={CHANNEL_BPM_MAX}
            step={0.1}
            required
            aria-invalid={!bpmValid}
          />
          {!bpmValid && (
            <p className="tl-field-hint tl-field-error">
              Enter a BPM between {CHANNEL_BPM_MIN} and {CHANNEL_BPM_MAX}.
            </p>
          )}
        </label>

        <div className="tl-dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="tl-btn-primary" disabled={!nameValid || !bpmValid}>Add</button>
        </div>
      </form>
    </dialog>
  )
}
