/**
 * A track's MIDI sequence: one entry per 16th-note step, looped by the server's channel player
 * (step i plays sequence[i % sequence.length], see server/channel/channel.js). Each entry is a MIDI
 * note number (an integer in [MIDI_NOTE_MIN, MIDI_NOTE_MAX]) or REST (-1) for no note.
 */

export const SEQUENCE_MAX_LENGTH = 16
export const MIDI_NOTE_MIN = 0
export const MIDI_NOTE_MAX = 127
/** A step that plays no note. */
export const REST = -1
/** MIDI note 60 (C4). */
export const MIDDLE_C = 60

/** Middle C on every downbeat (slots 0, 4, 8, 12), rests elsewhere. */
export const DEFAULT_SEQUENCE: readonly number[] = Array.from({ length: SEQUENCE_MAX_LENGTH }, (_, i) =>
  i % 4 === 0 ? MIDDLE_C : REST,
)

export function isValidStep(value: number): boolean {
  return Number.isInteger(value) && (value === REST || (value >= MIDI_NOTE_MIN && value <= MIDI_NOTE_MAX))
}

/** 1 to SEQUENCE_MAX_LENGTH steps, each a MIDI note or REST. */
export function isValidSequence(sequence: readonly number[]): boolean {
  return sequence.length >= 1 && sequence.length <= SEQUENCE_MAX_LENGTH && sequence.every(isValidStep)
}

/**
 * Parses one slot of the editor. Returns the number if it's a valid step, else null.
 * Only plain integers are accepted ("60", "-1"); "60.0", "1e2" or an empty slot are not.
 */
export function parseStep(text: string): number | null {
  const trimmed = text.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return isValidStep(value) ? value : null
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Note name with octave, middle C (60) being C4. REST gives '–'. */
export function noteName(note: number): string {
  if (note === REST) return '–'
  return `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`
}

/** The editor's slots as typed text, so a half-typed value ("-", "") can be shown and corrected. */
export type SequenceSlots = string[]

export function slotsFromSequence(sequence: readonly number[]): SequenceSlots {
  return Array.from({ length: SEQUENCE_MAX_LENGTH }, (_, i) => String(sequence[i] ?? REST))
}

/** The sequence the slots describe, or null while any slot is not a valid step. */
export function sequenceFromSlots(slots: SequenceSlots): number[] | null {
  const steps = slots.map(parseStep)
  return steps.every((s) => s !== null) ? (steps as number[]) : null
}
