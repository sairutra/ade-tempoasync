import { DEFAULT_RANDOM, DEFAULT_SPLIT, DEFAULT_WAVE, type PatternSpec, type WaveShape } from './patterns'
import { STEPS_PER_BAR, STEPS_PER_BEAT } from './tempo'

export type PatternKind = PatternSpec['kind']

/** Form state for the three pattern options: raw strings while typing, parsed by patternFromDraft. */
export type PatternDraft = {
  kind: PatternKind
  // Wave
  shape: WaveShape
  cyclesPerBar: string
  waveAmplitude: string
  /** Pulse width in percent. */
  pulseWidth: string
  sync: boolean
  // Random
  randomAmplitude: string
  stepsPerChange: number
  smooth: boolean
  syncBars: string
  seed: number
  // Split
  periodCount: string
  periodUnit: 'beats' | 'bars'
  /** Window as a fraction of the period, so 3/4 stays 3/4 when the period changes. */
  windowFraction: number
  windowBpm: string
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

export function defaultPatternDraft(syncBpm: number): PatternDraft {
  return {
    kind: 'wave',
    shape: DEFAULT_WAVE.shape,
    cyclesPerBar: String(DEFAULT_WAVE.cyclesPerBar),
    waveAmplitude: String(DEFAULT_WAVE.amplitude),
    pulseWidth: String(DEFAULT_WAVE.pulseWidth * 100),
    sync: DEFAULT_WAVE.sync,
    randomAmplitude: String(DEFAULT_RANDOM.amplitude),
    stepsPerChange: DEFAULT_RANDOM.stepsPerChange,
    smooth: DEFAULT_RANDOM.smooth,
    syncBars: String(DEFAULT_RANDOM.syncBars),
    seed: newSeed(),
    periodCount: '1',
    periodUnit: 'bars',
    windowFraction: DEFAULT_SPLIT.windowSteps / DEFAULT_SPLIT.periodSteps,
    windowBpm: String(Math.min(999, Math.round(syncBpm) + 20)),
  }
}

export const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export function periodSteps(draft: PatternDraft): number {
  return num(draft.periodCount) * (draft.periodUnit === 'bars' ? STEPS_PER_BAR : STEPS_PER_BEAT)
}

/** Window length in steps: at least one 16th, and always leaving one for the rest. */
export function windowSteps(draft: PatternDraft): number {
  const period = periodSteps(draft)
  return Math.min(period - 1, Math.max(1, Math.round(draft.windowFraction * period)))
}

/** The spec the draft describes (possibly invalid: check with patternError). */
export function patternFromDraft(draft: PatternDraft): PatternSpec {
  switch (draft.kind) {
    case 'wave':
      return {
        kind: 'wave',
        shape: draft.shape,
        cyclesPerBar: num(draft.cyclesPerBar),
        amplitude: num(draft.waveAmplitude),
        pulseWidth: num(draft.pulseWidth) / 100,
        sync: draft.sync,
      }
    case 'random':
      return {
        kind: 'random',
        amplitude: num(draft.randomAmplitude),
        stepsPerChange: draft.stepsPerChange,
        smooth: draft.smooth,
        syncBars: num(draft.syncBars),
        seed: draft.seed,
      }
    case 'split':
      return { kind: 'split', periodSteps: periodSteps(draft), windowSteps: windowSteps(draft), windowBpm: num(draft.windowBpm) }
  }
}
