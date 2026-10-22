import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { distinctColor, normalizeHex, suggestColor } from '../model/colors'
import { CHANNEL_MAX, CHANNEL_MIN, isValidChannel, type NewTrackInput } from '../model/newTrack'
import { DEFAULT_SEQUENCE, sequenceFromSlots, slotsFromSequence } from '../model/sequence'
import { defaultPatternDraft, patternFromDraft, type PatternDraft } from '../model/patternDraft'
import { patternError } from '../model/patterns'
import { PatternInput } from './PatternInput'
import { SequenceInput } from './SequenceInput'

export const CHANNEL_BPM_MIN = 1
export const CHANNEL_BPM_MAX = 999

type Props = {
  open: boolean
  /** Colours of the existing tracks: the picked colour must differ from these. */
  usedColors: readonly string[]
  /** Prefilled BPM (the project BPM). */
  defaultBpm: number
  /** Prefilled channel number (the lowest one not in use). */
  defaultChannel: number
  onSubmit: (channel: NewTrackInput) => void
  onClose: () => void
}

/**
 * Modal form for a new channel: name, colour, a straight line at a BPM or a generated pattern (see PatternInput), channel number (1–16) and a 16-step MIDI sequence
 * (middle C on every downbeat by default). A colour already used by another track is
 * shown (and saved) as a slightly different shade, so every line stays distinguishable.
 * Uses <dialog>.showModal(): focus trap, Escape and the backdrop come from the browser.
 */
export function AddChannelDialog({ open, usedColors, defaultBpm, defaultChannel, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const ids = useId()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#e07a5f')
  const [bpm, setBpm] = useState(String(defaultBpm))
  const [channel, setChannel] = useState(String(defaultChannel))
  const [slots, setSlots] = useState(() => slotsFromSequence(DEFAULT_SEQUENCE))
  const [lineMode, setLineMode] = useState<'flat' | 'pattern'>('flat')
  const [pattern, setPattern] = useState<PatternDraft>(() => defaultPatternDraft(defaultBpm))

  // Reset the form each time it opens, with a colour nobody uses yet.
  useEffect(() => {
    const dialog = dialogRef.current!
    if (open && !dialog.open) {
      setName('')
      setColor(suggestColor(usedColors))
      setBpm(String(defaultBpm))
      setChannel(String(defaultChannel))
      setSlots(slotsFromSequence(DEFAULT_SEQUENCE))
      setLineMode('flat')
      setPattern(defaultPatternDraft(defaultBpm))
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
  const channelValue = Number(channel)
  const channelValid = channel.trim() !== '' && isValidChannel(channelValue)
  const sequence = sequenceFromSlots(slots)
  const patternSpec = lineMode === 'pattern' ? patternFromDraft(pattern) : undefined
  const patternValid = patternSpec === undefined || (bpmValid && patternError(patternSpec, bpmValue) === null)
  const valid = nameValid && bpmValid && channelValid && sequence !== null && patternValid

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid || sequence === null) return
    onSubmit({ name: name.trim(), color: finalColor, bpm: bpmValue, channel: channelValue, sequence, pattern: patternSpec })
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

        <div className="tl-segmented" role="radiogroup" aria-label="Line">
          <label className="tl-segment">
            <input type="radio" name={`${ids}-line`} checked={lineMode === 'flat'} onChange={() => setLineMode('flat')} />
            <span>Straight line</span>
          </label>
          <label className="tl-segment">
            <input type="radio" name={`${ids}-line`} checked={lineMode === 'pattern'} onChange={() => setLineMode('pattern')} />
            <span>Generate pattern</span>
          </label>
        </div>

        <label className="tl-field">
          <span>{lineMode === 'flat' ? 'BPM' : 'Sync BPM'}</span>
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
          {lineMode === 'pattern' && bpmValid && (
            <p className="tl-field-hint">The pattern centres on this BPM and keeps time with it.</p>
          )}
        </label>

        {lineMode === 'pattern' && (
          <PatternInput draft={pattern} onChange={setPattern} syncBpm={bpmValid ? bpmValue : null} color={finalColor} />
        )}

        <label className="tl-field">
          <span>Channel</span>
          <input
            type="number"
            inputMode="numeric"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            min={CHANNEL_MIN}
            max={CHANNEL_MAX}
            step={1}
            required
            aria-invalid={!channelValid}
          />
          {!channelValid && (
            <p className="tl-field-hint tl-field-error">
              Enter a whole number between {CHANNEL_MIN} and {CHANNEL_MAX}.
            </p>
          )}
        </label>

        <SequenceInput slots={slots} onChange={setSlots} />

        <div className="tl-dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="tl-btn-primary" disabled={!valid}>Add</button>
        </div>
      </form>
    </dialog>
  )
}
