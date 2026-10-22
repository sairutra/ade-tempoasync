import { useId } from 'react'
import { MIDDLE_C, MIDI_NOTE_MAX, MIDI_NOTE_MIN, noteName, parseStep, REST, type SequenceSlots } from '../model/sequence'

type Props = {
  slots: SequenceSlots
  onChange: (slots: SequenceSlots) => void
}

/**
 * 16 integer fields, one per 16th-note step, in rows of 4 (one beat per row). Each takes a MIDI note
 * number or -1 for a rest; the note name is shown under each valid slot.
 */
export function SequenceInput({ slots, onChange }: Props) {
  const ids = useId()
  const invalid = slots.map((s) => parseStep(s) === null)
  const anyInvalid = invalid.some(Boolean)

  return (
    <fieldset className="tl-field tl-sequence" aria-describedby={`${ids}-help`}>
      <legend>MIDI sequence</legend>
      <p id={`${ids}-help`} className="tl-field-hint">
        One slot per 16th note, looped. Enter a MIDI note from {MIDI_NOTE_MIN} to {MIDI_NOTE_MAX} ({MIDDLE_C} is middle
        C; +1 is a semitone up, +12 an octave), or {REST} to play no note.
      </p>
      <div className="tl-sequence-grid">
        {slots.map((slot, i) => {
          const step = parseStep(slot)
          return (
            <label key={i} className="tl-sequence-slot">
              <input
                type="number"
                inputMode="numeric"
                value={slot}
                onChange={(e) => onChange(slots.map((s, j) => (j === i ? e.target.value : s)))}
                min={REST}
                max={MIDI_NOTE_MAX}
                step={1}
                required
                aria-label={`Step ${i + 1}`}
                aria-invalid={invalid[i]}
              />
              <span className="tl-sequence-note" aria-hidden="true">
                {step === null ? '?' : noteName(step)}
              </span>
            </label>
          )
        })}
      </div>
      {anyInvalid && (
        <p className="tl-field-hint tl-field-error">
          Each slot must be a whole number from {MIDI_NOTE_MIN} to {MIDI_NOTE_MAX}, or {REST} for no note.
        </p>
      )}
    </fieldset>
  )
}
