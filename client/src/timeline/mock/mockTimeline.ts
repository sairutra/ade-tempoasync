import { createTimelineState } from '../model/selectors'

/** `length` points of fn(i), rounded to 0.1 BPM. */
const curve = (length: number, fn: (i: number) => number): number[] =>
  Array.from({ length }, (_, i) => Math.round(fn(i) * 10) / 10)

const BAR = 16

/**
 * Five BPM curves over ~30 bars at 120 BPM (1 bar = 2 s). Bass and Keys share startStep 64, so their
 * header order falls back to name. Vocals briefly exceeds bpmMax to show render-time clamping;
 * Guitar ends early and holds its last BPM to the content end.
 */
export const mockTimeline = createTimelineState(
  [
    {
      id: 'drums', name: 'Drums', startStep: 0, sourceOffset: 0, color: '#e07a5f',
      // Steady 120, ramp to 140 over two bars, hold.
      bpms: curve(30 * BAR, (i) => (i < 8 * BAR ? 120 : 120 + 20 * Math.min(1, (i - 8 * BAR) / (2 * BAR)))),
    },
    {
      id: 'keys', name: 'Keys', startStep: 4 * BAR, sourceOffset: 0, color: '#81b29a',
      // Terraces: four-bar blocks stepping 90 → 110 → 130 → 110 …
      bpms: curve(24 * BAR, (i) => [90, 110, 130, 110][Math.floor(i / (4 * BAR)) % 4]),
    },
    {
      id: 'bass', name: 'Bass', startStep: 4 * BAR, sourceOffset: 0, color: '#3d85c6',
      // Wobble around 100 with a four-bar period.
      bpms: curve(22 * BAR, (i) => 100 + 15 * Math.sin((2 * Math.PI * i) / (4 * BAR))),
    },
    {
      id: 'vox', name: 'Vocals', startStep: 8 * BAR, sourceOffset: 0, color: '#c48bd6',
      // Slow climb 80 → 170, a one-bar spike past bpmMax (drawn clamped at 200), then back to 150.
      bpms: curve(14 * BAR, (i) => (i < 12 * BAR ? 80 + (90 * i) / (12 * BAR) : i < 13 * BAR ? 215 : 150)),
    },
    {
      id: 'gtr', name: 'Guitar', startStep: 12 * BAR, sourceOffset: 0, color: '#f2cc8f',
      // Decelerate 160 → 70 over six bars, then the line holds 70 to the end.
      bpms: curve(6 * BAR, (i) => 160 - (90 * i) / (6 * BAR - 1)),
    },
  ],
  { projectBpm: 120, bpmMin: 60, bpmMax: 200 },
)
