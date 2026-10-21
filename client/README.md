# client

DAW-style timeline UI. Vite + React + TypeScript, Vitest for tests. The Express app in `../server` is untouched.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # vitest run
npm run build   # tsc -b && vite build
```

## Timeline architecture

**Tracks are BPM curves.** x is an integer step (one 16th note at `projectBpm`), y is BPM.
Each track has exactly one point per step, with no gaps and never two points on one step. That is
stored as a start plus a dense array, so the invariant can't be broken by construction:

```ts
type Track = { id; name; startStep: number; bpms: number[]; sourceOffset; color? }
// bpms[i] is the BPM at step startStep + i; bpms.length >= 1
```

Points are joined by straight segments. Nothing is drawn before `startStep`; after the last point
the line holds the last BPM to the right edge of the content. There are no per-track lane rows:
every line shares the lane area's BPM axis, `TimelineState.bpmMin`–`bpmMax` (mock: 60–200), with
higher BPM drawn higher. Out-of-range values stay in the model as-is and are clamped only when
drawn (`clampBpm`). The header column is ordered by `startStep`, then name, then id
(`compareTracks` in `selectors.ts`), so header order is derived, not stored.

The timeline duration is `stepToTime(furthest last point over all tracks) + 2 s` of padding.

```
src/timeline/
  model/      types.ts, selectors.ts   – plain TS: Track (a BPM curve), TimelineState, ordering, duration
              tempo.ts                 – the one step↔seconds conversion (stepToTime / timeToStep)
              trackPath.ts             – SVG path + viewBox for a track, in model units (pure)
  viewport/   viewport.ts              – the one time↔px transform + scroll/zoom math (pure)
              ticks.ts                 – bar/beat/16th tick intervals and labels (pure)
              viewportReducer.ts       – scroll/zoom state transitions (pure)
  state/      TimelineProvider.tsx     – React wiring: model context + viewport context
  components/ Timeline, Ruler, GridCanvas, TrackHeader, TrackLine, Scrollbar,
              useCanvas, useWheelZoomScroll
  mock/       mockTimeline.ts          – 5 BPM curves over ~30 bars at 120 BPM, one start-step tie
```

**Steps and BPM, not pixels.** The model stores steps and BPM; the viewport works in seconds
(steps convert through `stepToTime`). Pixels come from one transform:

```ts
type Viewport = { pxPerSecond: number; scrollX: number }
timeToX(t, v) = t * v.pxPerSecond - v.scrollX
xToTime(x, v) = (x + v.scrollX) / v.pxPerSecond
```

For performance, lines apply the two halves separately: each line is placed at
`timeToContentX(stepToTime(startStep, bpm), pxPerSecond)` and the lane content layer is translated
by `-scrollX`. The result is exactly `timeToX`, but scrolling only changes one transform, and
memoized `TrackLine`s re-render only when zoom changes.

**One SVG per track.** `TrackLine` renders an `<svg>` from the track's first point to the content
end. Its viewBox is in model units — x in steps since `startStep`, y = `bpmMax - bpm`, height
`bpmMax - bpmMin` — with `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"` on
the path. Zooming only changes the svg's CSS width; the path (`M` first point, `L` through each
point, `H` to the content end) is rebuilt only when `bpms`, the BPM range or the content end
change. The name label sits just above the first point.

**Musical time on the ruler.** `TimelineState.projectBpm` (mock: 120) drives the ruler and grid.
The model and viewport stay in seconds; only the ticks are musical. Time signature is fixed 4/4:
1 bar = 4 beats = 16 steps, 1 step = one 16th note. Every step↔seconds conversion goes through
one pair of functions in `model/tempo.ts`:

```ts
stepToTime(step, bpm) = step * 60 / bpm / 4
timeToStep(seconds, bpm)   // its inverse
```

`pickTickScale(pxPerStep, minMinorSpacingPx)` picks intervals in steps from
`pxPerStep = pxPerSecond * stepToTime(1, bpm)`. Candidates, finest to coarsest: 16th, beat, bar,
then 2, 4, 8… bars. The major interval is the smallest candidate at least 60px apart (so labels
fit). The minor interval is the next finer candidate, drawn only if it is at least 5px apart on the
ruler or 12px apart on the grid. Ticks are generated on the integer step lattice, so ruler and grid
lines always coincide.

Tick weight comes from the musical position, not the zoom level: bar lines are tallest and
brightest, beats medium, 16ths shortest and faintest (`--tl-ruler-{bar,beat,step}`,
`--tl-grid-{bar,beat,step}`). Labels are 1-indexed and their precision follows the major unit:
bars → `5`, beats → `5.2`, 16ths → `5.2.3`.

**One horizontal scroll position.** `viewport.scrollX` is the single source of truth. The ruler
and grid canvases draw from it, the lane layer is translated by it, and the native scrollbar
mirrors it (user drags dispatch `scrollTo`; programmatic changes are written back). Nothing else
scrolls horizontally, so the ruler and lanes can't drift.

**Input.** Wheel events are coalesced per animation frame (`useWheelZoomScroll`):

- Ctrl/Cmd + wheel or trackpad pinch: zoom around the cursor (`zoomAt` keeps `xToTime(cursorX)` fixed)
- Trackpad horizontal swipe or Shift + wheel: horizontal scroll
- Plain vertical wheel: scrolls tracks vertically when they overflow, otherwise horizontally
- Toolbar: zoom out, zoom in (centered), Fit

Zoom is clamped to 2–2000 px/s. Scroll is clamped to `[0, duration × pxPerSecond − viewWidth]`.
The view zooms to fit on first measure.

**Canvases.** `useCanvas` sizes the backing store to CSS size × `devicePixelRatio`. It redraws on
`ResizeObserver` and DPR changes, and draws 1-device-pixel lines with `fillRect` at rounded device
coordinates. Colors come from CSS custom properties in `Timeline.css`.

**Rendering cost.** Lines that start right of the visible range (plus 200px overscan) aren't
rendered. Every line runs to the content end, so none can be entirely to the left.
`TrackHeader` and `TrackLine` are memoized. The model and viewport live in separate
contexts, so header components don't re-render on scroll or zoom.

**Store-ready.** `viewportReducer` and the model selectors are plain TS. To move to Zustand, wrap
them in a store and change the bodies of `useTimelineModel` / `useViewport`. Components stay as they are.

## Where milestones 3+ plug in

- **Point editing with undo.** Add a model reducer next to `viewportReducer`. Point edits map
  directly onto the storage: set `bpms[step - startStep]`, extend/trim by pushing or slicing the
  array (shifting `startStep` when trimming the front), move a whole track by changing
  `startStep`. Every edit returns a new `bpms` array, which is what invalidates the memoized path.
  Pointer x → step is `Math.round(timeToStep(xToTime(x, v), bpm))`; pointer y → BPM is
  `bpmMax - fraction * (bpmMax - bpmMin)`. The path already accepts pointer events on its stroke.
  Keep an undo stack of model snapshots or inverse actions in the provider, replacing the
  read-only `useState(initialState)`. The scroll clamp already re-runs when the duration changes
  (`setDuration`).
- **Audio engine + playhead.** Keep a non-React engine module (Web Audio) that owns the transport
  clock. Draw the playhead as its own absolutely positioned element or canvas, updated
  imperatively in a `requestAnimationFrame` loop via `timeToX(engine.currentTime, viewport)`, so
  playback never re-renders React. Tracks provide `startStep` (via `stepToTime`) and `sourceOffset` for scheduling.
- **Waveforms.** Compute min/max peaks per source file in a Web Worker at a few zoom resolutions.
  Render along `TrackLine` on a canvas that draws only the visible slice, picking the peak level from
  `pxPerSecond` and offsetting by `sourceOffset`.
