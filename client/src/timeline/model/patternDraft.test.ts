import { describe, expect, it } from 'vitest'
import { defaultPatternDraft, patternFromDraft } from './patternDraft'
import { patternError, splitRestBpm, type SplitPattern } from './patterns'

describe('pattern draft', () => {
  it('defaults to a valid pattern for every option, with the split at 3/4 of one measure', () => {
    const draft = defaultPatternDraft(120)
    for (const kind of ['wave', 'random', 'split'] as const) {
      expect(patternError(patternFromDraft({ ...draft, kind }), 120)).toBeNull()
    }
    const split = patternFromDraft({ ...draft, kind: 'split' }) as SplitPattern
    expect(split).toMatchObject({ periodSteps: 16, windowSteps: 12, windowBpm: 140 })
    expect(splitRestBpm(split, 120)).toBeCloseTo(84)
  })

  it('keeps the window fraction when the period changes, leaving at least one step', () => {
    const draft = { ...defaultPatternDraft(120), kind: 'split' as const }
    expect(patternFromDraft({ ...draft, periodCount: '2' })).toMatchObject({ periodSteps: 32, windowSteps: 24 })
    expect(patternFromDraft({ ...draft, periodUnit: 'beats', periodCount: '1', windowFraction: 1 })).toMatchObject({ periodSteps: 4, windowSteps: 3 })
  })

  it('parses an empty field as invalid', () => {
    expect(patternError(patternFromDraft({ ...defaultPatternDraft(120), waveAmplitude: '' }), 120)).not.toBeNull()
  })
})
