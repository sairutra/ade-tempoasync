import { useId } from 'react'
import { newSeed, num, patternFromDraft, periodSteps, windowSteps, type PatternDraft, type PatternKind } from '../model/patternDraft'
import {
  generatePattern,
  patternError,
  patternWindowSteps,
  quantizeInSync,
  splitRestBpm,
  WAVE_SHAPES,
  type PatternSpec,
  type WaveShape,
} from '../model/patterns'
import { STEPS_PER_BAR, STEPS_PER_BEAT } from '../model/tempo'

const KIND_LABELS: Record<PatternKind, string> = { wave: 'Wave', random: 'Random', split: 'Split period' }
const SHAPE_LABELS: Record<WaveShape, string> = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Saw', pulse: 'Pulse' }
const CHANGE_OPTIONS = [
  { steps: 1, label: '16th' },
  { steps: 2, label: '8th' },
  { steps: STEPS_PER_BEAT, label: 'Beat' },
  { steps: STEPS_PER_BAR, label: 'Bar' },
]

type Props = {
  draft: PatternDraft
  onChange: (draft: PatternDraft) => void
  /** The BPM the pattern keeps time with (the dialog's BPM field); null while that field is invalid. */
  syncBpm: number | null
  color: string
}

/** The three pattern generators (wave, random, split period) with a preview of the resulting line. */
export function PatternInput({ draft, onChange, syncBpm, color }: Props) {
  const ids = useId()
  const set = <K extends keyof PatternDraft>(key: K, value: PatternDraft[K]) => onChange({ ...draft, [key]: value })
  const spec = patternFromDraft(draft)
  const error = syncBpm === null ? null : patternError(spec, syncBpm)

  return (
    <fieldset className="tl-field tl-pattern">
      <legend>Pattern</legend>
      <div className="tl-segmented" role="radiogroup" aria-label="Pattern type">
        {(Object.keys(KIND_LABELS) as PatternKind[]).map((kind) => (
          <label key={kind} className="tl-segment">
            <input type="radio" name={`${ids}-kind`} checked={draft.kind === kind} onChange={() => set('kind', kind)} />
            <span>{KIND_LABELS[kind]}</span>
          </label>
        ))}
      </div>

      {draft.kind === 'wave' && (
        <>
          <div className="tl-segmented" role="radiogroup" aria-label="Wave shape">
            {WAVE_SHAPES.map((shape) => (
              <label key={shape} className="tl-segment">
                <input type="radio" name={`${ids}-shape`} checked={draft.shape === shape} onChange={() => set('shape', shape)} />
                <span>{SHAPE_LABELS[shape]}</span>
              </label>
            ))}
          </div>
          <div className="tl-field-row">
            <NumberField label="Cycles / bar" value={draft.cyclesPerBar} onChange={(v) => set('cyclesPerBar', v)} min={0.0625} step={0.25} />
            <NumberField label="Amplitude ± BPM" value={draft.waveAmplitude} onChange={(v) => set('waveAmplitude', v)} min={0} step={1} />
            {draft.shape === 'pulse' && (
              <NumberField label="Width %" value={draft.pulseWidth} onChange={(v) => set('pulseWidth', v)} min={1} max={99} step={5} />
            )}
          </div>
          <label className="tl-check">
            <input type="checkbox" checked={draft.sync} onChange={(e) => set('sync', e.target.checked)} />
            <span>Keep in sync (scale the wave so every cycle lasts as long as at the sync BPM)</span>
          </label>
        </>
      )}

      {draft.kind === 'random' && (
        <>
          <div className="tl-field-row">
            <NumberField label="Amplitude ± BPM" value={draft.randomAmplitude} onChange={(v) => set('randomAmplitude', v)} min={0} step={1} />
            <NumberField label="Sync every (bars)" value={draft.syncBars} onChange={(v) => set('syncBars', v)} min={1} step={1} />
          </div>
          <div className="tl-field-row tl-field-row-center">
            <span className="tl-inline-label">New value every</span>
            <div className="tl-segmented" role="radiogroup" aria-label="New value every">
              {CHANGE_OPTIONS.map(({ steps, label }) => (
                <label key={steps} className="tl-segment">
                  <input type="radio" name={`${ids}-change`} checked={draft.stepsPerChange === steps} onChange={() => set('stepsPerChange', steps)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="tl-field-row tl-field-row-center">
            <label className="tl-check">
              <input type="checkbox" checked={draft.smooth} onChange={(e) => set('smooth', e.target.checked)} />
              <span>Ramp between values</span>
            </label>
            <button type="button" className="tl-btn-small" onClick={() => set('seed', newSeed())}>Reroll</button>
          </div>
        </>
      )}

      {draft.kind === 'split' && <SplitFields draft={draft} set={set} syncBpm={syncBpm ?? NaN} />}

      {error && <p className="tl-field-hint tl-field-error" role="alert">{error}</p>}
      {!error && syncBpm !== null && <PatternPreview spec={spec} syncBpm={syncBpm} color={color} />}
    </fieldset>
  )
}

type SetDraft = <K extends keyof PatternDraft>(key: K, value: PatternDraft[K]) => void

function SplitFields({ draft, set, syncBpm }: { draft: PatternDraft; set: SetDraft; syncBpm: number }) {
  const ids = useId()
  const period = periodSteps(draft)
  const periodValid = Number.isInteger(period) && period >= 2
  const window = periodValid ? windowSteps(draft) : 0
  const windowBpm = num(draft.windowBpm)
  const rest = periodValid ? splitRestBpm({ periodSteps: period, windowSteps: window, windowBpm }, syncBpm) : null
  const beats = (steps: number) => +(steps / STEPS_PER_BEAT).toFixed(2)

  return (
    <>
      <div className="tl-field-row">
        <NumberField label="Period" value={draft.periodCount} onChange={(v) => set('periodCount', v)} min={1} step={1} />
        <label className="tl-subfield">
          <span>Unit</span>
          <select value={draft.periodUnit} onChange={(e) => set('periodUnit', e.target.value as PatternDraft['periodUnit'])}>
            <option value="bars">Measures (4 beats)</option>
            <option value="beats">Beats</option>
          </select>
        </label>
      </div>
      {periodValid && (
        <div className="tl-subfield">
          <label htmlFor={`${ids}-window`}>
            Window: {beats(window)} of {beats(period)} beats
          </label>
          <input
            id={`${ids}-window`}
            type="range"
            min={1}
            max={period - 1}
            step={1}
            value={window}
            onChange={(e) => set('windowFraction', Number(e.target.value) / period)}
            list={`${ids}-beats`}
          />
          <datalist id={`${ids}-beats`}>
            {Array.from({ length: Math.floor((period - 1) / STEPS_PER_BEAT) }, (_, i) => (
              <option key={i} value={(i + 1) * STEPS_PER_BEAT} />
            ))}
          </datalist>
        </div>
      )}
      <div className="tl-field-row tl-field-row-center">
        <NumberField label="Window BPM" value={draft.windowBpm} onChange={(v) => set('windowBpm', v)} min={1} max={999} step={1} />
        <p className="tl-split-rest" aria-live="polite">
          Rest: <strong>{rest === null || !Number.isFinite(rest) ? '—' : `${rest.toFixed(1)} BPM`}</strong>
        </p>
      </div>
    </>
  )
}

function NumberField({ label, value, onChange, min, max, step }: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="tl-subfield">
      <span>{label}</span>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max} step={step} />
    </label>
  )
}

const PREVIEW_W = 320
const PREVIEW_H = 72
const PREVIEW_PAD = 4
/** At least this many steps are previewed, and at least two sync windows when they are short. */
const PREVIEW_MIN_STEPS = 2 * STEPS_PER_BAR
const PREVIEW_MAX_STEPS = 8 * STEPS_PER_BAR

/** The pattern's first windows as they will be stored, with the sync BPM dashed and window ends ticked. */
function PatternPreview({ spec, syncBpm, color }: { spec: PatternSpec; syncBpm: number; color: string }) {
  const window = patternWindowSteps(spec)
  const steps = Math.min(PREVIEW_MAX_STEPS, Math.max(PREVIEW_MIN_STEPS, 2 * window))
  const bpms = quantizeInSync(generatePattern(spec, syncBpm, steps))
  // Pad the range a little so a flat line or a line at the sync BPM is still visible.
  const lo = Math.min(syncBpm, ...bpms) - 2
  const hi = Math.max(syncBpm, ...bpms) + 2
  const x = (i: number) => PREVIEW_PAD + (i / (steps - 1)) * (PREVIEW_W - 2 * PREVIEW_PAD)
  const y = (bpm: number) => PREVIEW_PAD + ((hi - bpm) / (hi - lo)) * (PREVIEW_H - 2 * PREVIEW_PAD)
  const points = bpms.map((b, i) => `${x(i).toFixed(1)},${y(b).toFixed(1)}`).join(' ')
  const windowEnds = Array.from({ length: Math.floor((steps - 1) / window) }, (_, k) => (k + 1) * window)
  const min = Math.min(...bpms)
  const max = Math.max(...bpms)
  const windowLabel = window % STEPS_PER_BAR === 0 ? `${window / STEPS_PER_BAR} bar${window === STEPS_PER_BAR ? '' : 's'}` : `${window / STEPS_PER_BEAT} beats`
  const synced = spec.kind !== 'wave' || spec.sync

  return (
    <figure className="tl-pattern-preview">
      <svg viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} role="img" aria-label={`Preview: ${min.toFixed(1)} to ${max.toFixed(1)} BPM`}>
        {windowEnds.map((s) => (
          <line key={s} className="tl-pattern-preview-window" x1={x(s)} x2={x(s)} y1={0} y2={PREVIEW_H} />
        ))}
        <line className="tl-pattern-preview-sync" x1={0} x2={PREVIEW_W} y1={y(syncBpm)} y2={y(syncBpm)} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      <figcaption className="tl-field-hint">
        {min.toFixed(1)}–{max.toFixed(1)} BPM · {synced ? `in sync with ${syncBpm} BPM every ${windowLabel}` : 'not synced: drifts from the sync BPM'}
      </figcaption>
    </figure>
  )
}
