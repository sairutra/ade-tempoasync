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
stored as a dense array from step 0, so the invariant can't be broken by construction, and every
line starts at the first step of the timeline:

```ts
type Track = { id; name; bpms: number[]; nodes: number[]; sourceOffset; color? }
// bpms[i] is the BPM at step i; bpms.length >= 1
```

Points are joined by straight segments. After the last point the line holds the last BPM to the
end of the timeline, so every line spans the whole timeline with no gaps. There are no per-track lane rows:
every line shares the lane area's BPM axis, `TimelineState.bpmMin`–`bpmMax` (mock: 60–200), with
higher BPM drawn higher. Out-of-range values stay in the model as-is and are clamped only when
drawn (`clampBpm`). The header column is ordered by name, then id
(`compareTracks` in `selectors.ts`), so header order is derived, not stored.

**The BPM range is editable.** The y-axis column left of the lanes labels the BPM range; the inputs
above it (max) and below it (min) change `bpmMin`/`bpmMax` via the `setBpmRange` model action.
Values are committed on Enter/blur (↑/↓ step by 1, Shift by 10; Escape reverts) and normalized by
`normalizeBpmRange`: whole BPM, within 1–999, at least 10 BPM wide; the end you edited wins and
pushes the other one if they'd cross. Points outside a narrowed range keep their values (drawn
clamped), and dragging still clamps edits into the current range.

The timeline duration is `stepToTime(furthest last point over all tracks) + 2 s` of padding.

```
src/timeline/
  model/      types.ts, selectors.ts   – plain TS: Track (a BPM curve), TimelineState, ordering, duration
              tempo.ts                 – the one step↔seconds conversion (stepToTime / timeToStep)
              trackPath.ts             – SVG path + viewBox for a track, in model units (pure)
  viewport/   viewport.ts              – the one time↔px transform + scroll/zoom math (pure)
              ticks.ts                 – bar/beat/16th tick intervals and labels (pure)
              bpmViewport.ts           – the BPM↔px transform, vertical scroll/zoom, BPM ticks (pure)
              viewportReducer.ts       – scroll/zoom state transitions, both axes (pure)
  playback/   transport.ts             – transport state + position at the project BPM (pure)
              transportClock.ts        – non-React clock: rAF loop, play/pause/stop/seek, listeners
              format.ts                – bar.beat.16th and m:ss.mmm readouts
  state/      TimelineProvider.tsx     – React wiring: model, viewport and transport-clock contexts
  components/ Timeline, Ruler, GridCanvas, BpmAxis, BpmRangeInput, TrackHeader, TrackLine,
              Scrollbar, TransportBar, Playhead, useCanvas, useWheelZoomScroll
  mock/       mockTimeline.ts          – 5 BPM curves over ~30 bars at 120 BPM, all starting at step 0
```

**Steps and BPM, not pixels.** The model stores steps and BPM; the viewport works in seconds
(steps convert through `stepToTime`). Pixels come from one transform:

```ts
type Viewport = { pxPerSecond: number; scrollX: number }
timeToX(t, v) = t * v.pxPerSecond - v.scrollX
xToTime(x, v) = (x + v.scrollX) / v.pxPerSecond
```

For performance, lines apply the two halves separately: every line starts at content x = 0 (step
0), and the lane content layer is translated by `-scrollX`. The result is exactly `timeToX`, but scrolling only changes one transform, and
memoized `TrackLine`s re-render only when zoom changes.

**One SVG per track.** `TrackLine` renders an `<svg>` from step 0 to the timeline end. Its viewBox
is in model units — x in steps, y = `bpmMax - bpm`, height
`bpmMax - bpmMin` — with `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"` on
the path. Zooming only changes the svg's CSS width; the path (`M` first point, `L` through each
point, `H` to the timeline end) is rebuilt only when `bpms`, the BPM range or the timeline end
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

- Ctrl/Cmd + wheel or trackpad pinch: zoom time around the cursor (`zoomAt` keeps `xToTime(cursorX)` fixed)
- Ctrl/Cmd + wheel or pinch over the BPM axis, or Alt + wheel anywhere: stretch the BPM axis
  around the cursor (`zoomYAt` keeps `yToBpm(cursorY)` fixed)
- Trackpad horizontal swipe or Shift + wheel: horizontal scroll
- Plain vertical wheel: scrolls the BPM axis when it's stretched past the view, otherwise horizontally
- BPM axis: drag to scroll vertically, double-click to fit the range; vertical scrollbar on the right
- Toolbar: zoom out, zoom in (centered), Fit (both axes)

Zoom is clamped to 2–2000 px/s. Scroll is clamped to `[0, duration × pxPerSecond − viewWidth]`.
The view zooms to fit on first measure.

**Vertical zoom.** `bpmViewport.ts` mirrors `viewport.ts` for the y-axis. Content is the BPM range
plus fixed padding (22px above `bpmMax` for line labels, 10px below `bpmMin`):

```
y(bpm) = PAD_TOP + (bpmMax - bpm) × pxPerBpm - scrollY
pxPerBpm = (viewHeight - PAD_TOP - PAD_BOTTOM) / (bpmMax - bpmMin) × zoom      // zoom ∈ [1, 40]
```

Zoom is stored relative to fit, so zoom 1 always shows the whole range and a resize or a new range
keeps the same stretch; on a range change the BPM at the view's centre stays put where possible
(`rebound`). Lines need no new math: `.tl-lines` just gets `top = PAD_TOP` and
`height = (bpmMax - bpmMin) × pxPerBpm`, and the lanes content uses one `translate(-scrollX, -scrollY)`.
Axis labels and the horizontal grid lines share `visibleBpmTicks`: the smallest 1/2/5 × 10ⁿ interval
at least 22px apart, powers of ten emphasised, and the range ends always labelled.

**Canvases.** `useCanvas` sizes the backing store to CSS size × `devicePixelRatio`. It redraws on
`ResizeObserver` and DPR changes, and draws 1-device-pixel lines with `fillRect` at rounded device
coordinates. Colors come from CSS custom properties in `Timeline.css`.

**Rendering cost.** Lines that start right of the visible range (plus 200px overscan) aren't
rendered. Every line runs to the content end, so none can be entirely to the left.
`TrackHeader` and `TrackLine` are memoized. The model and viewport live in separate
contexts, so header components don't re-render on scroll or zoom.

**Store-ready.** `viewportReducer` and the model selectors are plain TS. To move to Zustand, wrap
them in a store and change the bodies of `useTimelineModel` / `useViewport`. Components stay as they are.

**Playback.** The playhead advances at the project BPM: 4 steps per beat, so
`projectBpm × 4 / 60` steps per second (8 at 120 BPM). Its position is stored in steps, and while
playing it is derived from an anchor rather than accumulated per frame, so it doesn't drift:

```ts
step(now) = anchorStep + timeToStep((now - anchorTimeMs) / 1000, projectBpm)
```

`TransportClock` (plain TS) owns that state and runs one `requestAnimationFrame` loop while
playing. `Playhead` and the transport readout subscribe with `clock.onFrame` and write their DOM
directly, so playback never re-renders React; `useIsPlaying` re-renders only on play/pause.
If the BPM changes mid-play, the clock re-anchors at the current step (`rebase`), so the playhead
keeps its musical position and continues at the new speed.

- Play/pause button or Space; Stop returns the playhead to 1.1.1
- Click or drag on the ruler to move the playhead (snapped to 16ths); works while playing
- Playback pauses at the end of the timeline; Play from there restarts at 0
- While playing, the view pages forward when the playhead crosses its right edge. Only a crossing
  triggers this, so you can scroll elsewhere during playback without being pulled back

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
- **Audio engine.** The playhead and transport are in place (see Playback). For sound, drive
  `TransportClock` from `AudioContext.currentTime` instead of `performance.now()` (it takes its
  clock as a dependency), and schedule sources ahead from the anchor. Tracks provide `startStep`
  (via `stepToTime`) and `sourceOffset` for scheduling.
- **Waveforms.** Compute min/max peaks per source file in a Web Worker at a few zoom resolutions.
  Render along `TrackLine` on a canvas that draws only the visible slice, picking the peak level from
  `pxPerSecond` and offsetting by `sourceOffset`.
