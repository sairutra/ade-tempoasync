import { useState } from 'react'
import { BPM_RANGE_CEIL, BPM_RANGE_FLOOR } from '../model/selectors'

type Props = {
  /** Which end of the range this edits; shown at the top (max) or bottom (min) of the y-axis. */
  end: 'min' | 'max'
  value: number
  /** Called with the typed value on Enter or blur; the model normalizes it (see normalizeBpmRange). */
  onCommit: (value: number) => void
}

/**
 * Editable end of the y-axis BPM range. Typing doesn't touch the model: the draft is committed on
 * Enter or blur (arrow keys step by 1, Shift by 10, and commit right away), and Escape reverts it. Invalid input
 * reverts to the current value; a value that would make the range too narrow pushes the other end.
 */
export function BpmRangeInput({ end, value, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (text: string) => {
    setDraft(null)
    const n = Number(text)
    if (text.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n)
  }

  return (
    <input
      className="tl-range-input"
      type="number"
      inputMode="numeric"
      min={BPM_RANGE_FLOOR}
      max={BPM_RANGE_CEIL}
      step={1}
      value={draft ?? String(value)}
      aria-label={end === 'max' ? 'Maximum BPM' : 'Minimum BPM'}
      title={end === 'max' ? 'Top of the BPM axis' : 'Bottom of the BPM axis'}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(e.currentTarget.value)
        else if (e.key === 'Escape') setDraft(null)
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // Step from the committed value and apply right away (Shift: by 10).
          e.preventDefault()
          const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)
          commit(String(value + delta))
        }
      }}
    />
  )
}
