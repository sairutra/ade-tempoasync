/**
 * Generated tempo patterns for new tracks.
 *
 * "In sync" with a sync BPM P over a period of N steps means the period takes exactly as long as N
 * steps at P: since step i lasts stepToTime(1, bpms[i]) = 15 / bpms[i] seconds, that is
 * sum(1 / bpms[i]) = N / P, i.e. the harmonic mean of the period's BPMs is P. Each generator below
 * produces exact (unrounded) BPMs that satisfy this per sync window; quantizeInSync then rounds them
 * to the edit resolution without letting the rounding error accumulate into drift.
 */
import { EDIT_RESOLUTION_BPM, roundBpm } from './nodes'
import { STEPS_PER_BAR, STEPS_PER_BEAT } from './tempo'

export const PATTERN_BPM_MIN = 1
export const PATTERN_BPM_MAX = 999

export type WaveShape = 'sine' | 'triangle' | 'sawtooth' | 'pulse'
export const WAVE_SHAPES: readonly WaveShape[] = ['sine', 'triangle', 'sawtooth', 'pulse']

/** Option 1: a periodic wave around the sync BPM. */
export type WavePattern = {
  kind: 'wave'
  shape: WaveShape
  /** Wave cycles per bar (4 beats); 0.25 = one cycle every 4 bars. */
  cyclesPerBar: number
  /** Peak deviation from the sync BPM. */
  amplitude: number
  /** Pulse only: fraction of each cycle spent high, in (0, 1). */
  pulseWidth: number
  /** Scale the wave so each sync window keeps time with the sync BPM. */
  sync: boolean
}

/** Option 2: random values within ±amplitude of the sync BPM, corrected to stay in sync. */
export type RandomPattern = {
  kind: 'random'
  amplitude: number
  /** A new random value every this many steps (1 = every 16th, 4 = every beat). */
  stepsPerChange: number
  /** Ramp linearly between the random values (true) or hold each one (false). */
  smooth: boolean
  /** Length of a sync window in bars: every window lasts exactly as long as at the sync BPM. */
  syncBars: number
  seed: number
}

/** Option 3: the first `windowSteps` of each period at `windowBpm`, the rest at whatever BPM keeps the period in sync. */
export type SplitPattern = {
  kind: 'split'
  periodSteps: number
  windowSteps: number
  windowBpm: number
}

export type PatternSpec = WavePattern | RandomPattern | SplitPattern

/** Steps per sync window: the generated line is repeated / corrected in units of this length. */
export function patternWindowSteps(spec: PatternSpec): number {
  switch (spec.kind) {
    case 'wave':
      return waveWindowSteps(spec.cyclesPerBar)
    case 'random':
      return spec.syncBars * STEPS_PER_BAR
    case 'split':
      return spec.periodSteps
  }
}

/** Longest window searched for a whole number of wave cycles, in bars. */
export const WAVE_MAX_WINDOW_BARS = 64

/**
 * The shortest whole number of bars holding a whole number of cycles, so the wave repeats exactly
 * per window. When there is none within WAVE_MAX_WINDOW_BARS, one bar (sync still holds per bar,
 * but the scaling may differ slightly from bar to bar).
 */
export function waveWindowSteps(cyclesPerBar: number): number {
  for (let bars = 1; bars <= WAVE_MAX_WINDOW_BARS; bars++) {
    const cycles = cyclesPerBar * bars
    if (Math.round(cycles) >= 1 && Math.abs(cycles - Math.round(cycles)) < 1e-9) return bars * STEPS_PER_BAR
  }
  return STEPS_PER_BAR
}

/** Wave value at `phase` (cycles, any real), in [-1, 1]. Every shape starts at 0 or its high side. */
export function waveValue(shape: WaveShape, phase: number, pulseWidth = 0.5): number {
  const p = phase - Math.floor(phase)
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * p)
    case 'triangle':
      return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4
    case 'sawtooth':
      return p < 0.5 ? 2 * p : 2 * p - 2
    case 'pulse':
      return p < pulseWidth ? 1 : -1
  }
}

/**
 * The BPM after the window that keeps a split period in sync, or null when no positive BPM can
 * (the window alone already takes as long as the whole period at the sync BPM, or longer).
 */
export function splitRestBpm(spec: Pick<SplitPattern, 'periodSteps' | 'windowSteps' | 'windowBpm'>, syncBpm: number): number | null {
  const restSteps = spec.periodSteps - spec.windowSteps
  const restTime = spec.periodSteps / syncBpm - spec.windowSteps / spec.windowBpm // in units of 1/BPM per step
  if (restSteps <= 0 || !(restTime > 0)) return null
  return restSteps / restTime
}

/** Why `spec` can't be generated around `syncBpm`, or null if it can. */
export function patternError(spec: PatternSpec, syncBpm: number): string | null {
  if (!(syncBpm >= PATTERN_BPM_MIN && syncBpm <= PATTERN_BPM_MAX)) return `Sync BPM must be between ${PATTERN_BPM_MIN} and ${PATTERN_BPM_MAX}.`
  switch (spec.kind) {
    case 'wave':
    case 'random': {
      if (!(spec.amplitude >= 0)) return 'Amplitude must be 0 or more.'
      if (syncBpm - spec.amplitude < PATTERN_BPM_MIN) return `Amplitude must be below the sync BPM (${syncBpm}).`
      if (syncBpm + spec.amplitude > PATTERN_BPM_MAX) return `Sync BPM + amplitude must not exceed ${PATTERN_BPM_MAX}.`
      if (spec.kind === 'wave') {
        if (!(spec.cyclesPerBar > 0 && spec.cyclesPerBar <= STEPS_PER_BAR / 2)) return `Frequency must be above 0 and at most ${STEPS_PER_BAR / 2} cycles per bar.`
        if (!(spec.pulseWidth > 0 && spec.pulseWidth < 1)) return 'Pulse width must be between 0 and 100%.'
      } else {
        if (!Number.isInteger(spec.stepsPerChange) || spec.stepsPerChange < 1) return 'Change interval must be a whole number of steps.'
        if (!Number.isInteger(spec.syncBars) || spec.syncBars < 1) return 'Sync window must be a whole number of bars.'
        if ((spec.syncBars * STEPS_PER_BAR) % spec.stepsPerChange !== 0) return 'The sync window must hold a whole number of changes.'
      }
      return null
    }
    case 'split': {
      if (!Number.isInteger(spec.periodSteps) || spec.periodSteps < 2) return 'The period must be at least two 16th notes.'
      if (!Number.isInteger(spec.windowSteps) || spec.windowSteps < 1 || spec.windowSteps >= spec.periodSteps) return 'The window must leave part of the period free.'
      if (!(spec.windowBpm >= PATTERN_BPM_MIN && spec.windowBpm <= PATTERN_BPM_MAX)) return `Window BPM must be between ${PATTERN_BPM_MIN} and ${PATTERN_BPM_MAX}.`
      const rest = splitRestBpm(spec, syncBpm)
      if (rest === null) return 'The window is too slow: it already takes longer than the whole period at the sync BPM.'
      if (rest > PATTERN_BPM_MAX) return `The rest of the period would need ${Math.round(rest)} BPM (max ${PATTERN_BPM_MAX}).`
      return null
    }
  }
}

/** Deterministic PRNG in [0, 1) (mulberry32), so a seed reproduces a random pattern exactly. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Scales each window of `windowSteps` points so its harmonic mean is `syncBpm` (a final partial
 * window is corrected on its own). Multiplying keeps the shape: a ramp stays a ramp.
 */
export function syncPerWindow(bpms: readonly number[], windowSteps: number, syncBpm: number): number[] {
  const out = bpms.slice()
  for (let start = 0; start < out.length; start += windowSteps) {
    const end = Math.min(start + windowSteps, out.length)
    let inverse = 0
    for (let i = start; i < end; i++) inverse += 1 / out[i]
    const scale = (syncBpm * inverse) / (end - start)
    for (let i = start; i < end; i++) out[i] *= scale
  }
  return out
}

/**
 * Rounds BPMs to the edit resolution with error diffusion on time: each point takes whichever
 * neighbouring rounded BPM keeps the rounded line's elapsed time closest to the exact line's. Plain
 * rounding would drift (e.g. 111.43 → 111.4 is early on every step); this keeps the offset under
 * one step's rounding error for the whole line, so the line stays in sync at every window end.
 */
export function quantizeInSync(bpms: readonly number[]): number[] {
  let exact = 0
  let rounded = 0
  return bpms.map((bpm) => {
    exact += 1 / bpm
    const lo = roundBpm(Math.floor(bpm / EDIT_RESOLUTION_BPM + 1e-9) * EDIT_RESOLUTION_BPM)
    const hi = roundBpm(lo + EDIT_RESOLUTION_BPM)
    const candidates = lo >= PATTERN_BPM_MIN ? [lo, hi] : [hi]
    let best = candidates[0]
    for (const c of candidates) {
      if (Math.abs(rounded + 1 / c - exact) < Math.abs(rounded + 1 / best - exact)) best = c
    }
    rounded += 1 / best
    return best
  })
}

/** Exact (unrounded) BPMs of `spec` for `length` steps, synced to `syncBpm`. Throws on an invalid spec. */
export function generatePattern(spec: PatternSpec, syncBpm: number, length: number): number[] {
  const error = patternError(spec, syncBpm)
  if (error) throw new Error(error)
  const window = patternWindowSteps(spec)

  if (spec.kind === 'wave') {
    const raw = Array.from({ length }, (_, i) =>
      syncBpm + spec.amplitude * waveValue(spec.shape, (i * spec.cyclesPerBar) / STEPS_PER_BAR, spec.pulseWidth),
    )
    return spec.sync ? syncPerWindow(raw, window, syncBpm) : raw
  }

  if (spec.kind === 'random') {
    const random = seededRandom(spec.seed)
    const keys = Array.from({ length: Math.ceil(length / spec.stepsPerChange) + 1 }, () =>
      syncBpm + spec.amplitude * (2 * random() - 1),
    )
    const raw = Array.from({ length }, (_, i) => {
      const k = Math.floor(i / spec.stepsPerChange)
      if (!spec.smooth) return keys[k]
      const t = (i - k * spec.stepsPerChange) / spec.stepsPerChange
      return keys[k] + (keys[k + 1] - keys[k]) * t
    })
    return syncPerWindow(raw, window, syncBpm)
  }

  const rest = splitRestBpm(spec, syncBpm)!
  return Array.from({ length }, (_, i) => (i % spec.periodSteps < spec.windowSteps ? spec.windowBpm : rest))
}

/** `length` rounded up to whole sync windows, so a generated line ends on a point where it is in sync. */
export function patternLength(spec: PatternSpec, length: number): number {
  const window = patternWindowSteps(spec)
  return Math.ceil(length / window) * window
}

/** Default specs for the three options. */
export const DEFAULT_WAVE: WavePattern = { kind: 'wave', shape: 'sine', cyclesPerBar: 1, amplitude: 20, pulseWidth: 0.5, sync: true }
export const DEFAULT_RANDOM: Omit<RandomPattern, 'seed'> = { kind: 'random', amplitude: 20, stepsPerChange: STEPS_PER_BEAT, smooth: true, syncBars: 1 }
export const DEFAULT_SPLIT: Omit<SplitPattern, 'windowBpm'> = { kind: 'split', periodSteps: STEPS_PER_BAR, windowSteps: (STEPS_PER_BAR * 3) / 4 }
