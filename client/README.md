# client

DAW-style timeline UI. Vite + React + TypeScript, Vitest for tests. The Express app in `../server` is untouched.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # vitest run
npm run build   # tsc -b && vite build
```

## Timeline architecture

**Tracks are lines.** Each track is a single line with `start`, `duration` and a vertical
position `y` (0 = top, 1 = bottom of the lane area). There are no per-track lane rows: lines can
sit anywhere inside `.tl-lanes`. The header column is ordered by line start time, with ties broken
alphabetically by name (`compareTracks` in `selectors.ts`), so header order is derived, not stored.

```
src/timeline/
  model/      types.ts, selectors.ts   – plain TS: Track (one line per track), TimelineState
              tempo.ts                 – the one step↔seconds conversion (stepToTime / timeToStep)
  viewport/   viewport.ts              – the one time↔px transform + scroll/zoom math (pure)
              ticks.ts                 – bar/beat/16th tick intervals and labels (pure)
              viewportReducer.ts       – scroll/zoom state transitions (pure)
  state/      TimelineProvider.tsx     – React wiring: model context + viewport context
  components/ Timeline, Ruler, GridCanvas, TrackHeader, TrackLine, Scrollbar,
              useCanvas, useWheelZoomScroll
  mock/       mockTimeline.ts          – 5 tracks over ~60s at 120 BPM, with two start-time ties
```

**Time, not pixels.** The model stores seconds only. Pixels come from one transform:

```ts
type Viewport = { pxPerSecond: number; scrollX: number }
timeToX(t, v) = t * v.pxPerSecond - v.scrollX
xToTime(x, v) = (x + v.scrollX) / v.pxPerSecond
```

For performance, lines apply the two halves separately: each line is placed at
`timeToContentX(start, pxPerSecond)` and the lane content layer is translated by `-scrollX`.
The result is exactly `timeToX`, but scrolling only changes one transform, and memoized
`TrackLine`s re-render only when zoom changes.

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

**Rendering cost.** Lines outside the visible range (plus 200px overscan) aren't rendered.
`TrackHeader` and `TrackLine` are memoized. The model and viewport live in separate
contexts, so header components don't re-render on scroll or zoom.

**Store-ready.** `viewportReducer` and the model selectors are plain TS. To move to Zustand, wrap
them in a store and change the bodies of `useTimelineModel` / `useViewport`. Components stay as they are.

## Where milestones 3+ plug in

- **Drag/trim with undo.** Add a model reducer next to `viewportReducer` (`moveTrack` for x and y, `trimStart`
  adjusting `start` + `sourceOffset`, `trimEnd`). Keep an undo stack of model snapshots or inverse
  actions in the provider, replacing the read-only `useState(initialState)`. Pointer handlers go
  in `TrackLine`, converting pointer x with `xToTime`. Snapping can round to the visible
  grid interval in steps (`pickTickScale`) via `timeToStep` / `stepToTime`.
  The clamp already re-runs when the duration changes (`setDuration`).
- **Audio engine + playhead.** Keep a non-React engine module (Web Audio) that owns the transport
  clock. Draw the playhead as its own absolutely positioned element or canvas, updated
  imperatively in a `requestAnimationFrame` loop via `timeToX(engine.currentTime, viewport)`, so
  playback never re-renders React. Tracks provide `start`/`duration`/`sourceOffset` for scheduling.
- **Waveforms.** Compute min/max peaks per source file in a Web Worker at a few zoom resolutions.
  Render along `TrackLine` on a canvas that draws only the visible slice, picking the peak level from
  `pxPerSecond` and offsetting by `sourceOffset`.
