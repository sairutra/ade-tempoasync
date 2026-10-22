import { BEATS_PER_BAR } from './tempo'

/**
 * Tempo alignment: which track BPMs lock to the project grid within one 4/4 bar.
 *
 * A track at `projectBpm * trackBeats / projectBeats` plays exactly `trackBeats` beats in the time
 * the project plays `projectBeats` beats, so their beats coincide again after that segment. Both
 * counts go up to one bar (BEATS_PER_BAR), giving ratios like 1:2, 2:1, 4:3, 1:4.
 *
 *   project 90  → 45 (1:2), 120 (4:3), 180 (2:1), …
 *   project 100 → 25 (1:4), …
 */
export type AlignmentKind = 'unison' | 'power' | 'other'

export type Alignment = {
  bpm: number
  /** Track beats in the shared segment. */
  trackBeats: number
  /** Project beats in the shared segment. */
  projectBeats: number
  /** unison: 1:1; power: a power-of-two ratio (1:2, 2:1, 1:4, 4:1); other: everything else. */
  kind: AlignmentKind
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Every reduced trackBeats:projectBeats with both in 1..maxBeats, sorted by ratio ascending. */
export function alignmentRatios(maxBeats = BEATS_PER_BAR): { trackBeats: number; projectBeats: number }[] {
  const ratios: { trackBeats: number; projectBeats: number }[] = []
  for (let t = 1; t <= maxBeats; t++) {
    for (let p = 1; p <= maxBeats; p++) {
      if (gcd(t, p) === 1) ratios.push({ trackBeats: t, projectBeats: p })
    }
  }
  return ratios.sort((a, b) => a.trackBeats / a.projectBeats - b.trackBeats / b.projectBeats)
}

const isPowerOfTwo = (n: number) => (n & (n - 1)) === 0

function kindOf(trackBeats: number, projectBeats: number): AlignmentKind {
  if (trackBeats === projectBeats) return 'unison'
  return isPowerOfTwo(trackBeats) && isPowerOfTwo(projectBeats) ? 'power' : 'other'
}

/** Aligned BPMs for `projectBpm` inside [bpmMin, bpmMax], lowest first. */
export function alignedBpms(projectBpm: number, bpmMin: number, bpmMax: number, maxBeats = BEATS_PER_BAR): Alignment[] {
  if (!(projectBpm > 0)) return []
  const out: Alignment[] = []
  for (const { trackBeats, projectBeats } of alignmentRatios(maxBeats)) {
    const bpm = (projectBpm * trackBeats) / projectBeats
    if (bpm < bpmMin - 1e-9 || bpm > bpmMax + 1e-9) continue
    out.push({ bpm, trackBeats, projectBeats, kind: kindOf(trackBeats, projectBeats) })
  }
  return out
}

/** Short label: `4:3 · 120` (track beats : project beats · BPM, up to 2 decimals). */
export function formatAlignment(a: Alignment): string {
  const bpm = Math.round(a.bpm * 100) / 100
  return `${a.trackBeats}:${a.projectBeats} · ${bpm}`
}
