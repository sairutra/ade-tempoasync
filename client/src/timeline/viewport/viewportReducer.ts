import { DEFAULT_BPM_MAX, DEFAULT_BPM_MIN } from '../model/selectors'
import {
  clampViewport,
  scrollBy,
  scrollTo,
  zoomAt,
  zoomToFit,
  MIN_PX_PER_SECOND,
  type Viewport,
  type ViewportBounds,
} from './viewport'
import {
  rebound,
  scrollYBy,
  scrollYTo,
  zoomYAt,
  zoomYToFit,
  type BpmBounds,
  type BpmViewport,
} from './bpmViewport'

/**
 * Plain reducer so it works with useReducer today and can back a store
 * (e.g. Zustand: set((s) => viewportReducer(s, action))) later.
 */
export type ViewportState = {
  viewport: Viewport
  bounds: ViewportBounds
  /** False until the first real measurement, which triggers an initial zoom-to-fit. */
  fitted: boolean
  /** Vertical (BPM) axis: zoom relative to fit, and scroll. See bpmViewport.ts. */
  bpmViewport: BpmViewport
  bpmBounds: BpmBounds
}

export type ViewportAction =
  | { type: 'resize'; viewWidth: number }
  | { type: 'setDuration'; duration: number }
  | { type: 'scrollBy'; dx: number }
  | { type: 'scrollTo'; scrollX: number }
  | { type: 'zoomAt'; factor: number; anchorX: number }
  | { type: 'zoomToFit' }
  | { type: 'resizeY'; viewHeight: number }
  | { type: 'setBpmRange'; bpmMin: number; bpmMax: number }
  | { type: 'scrollYBy'; dy: number }
  | { type: 'scrollYTo'; scrollY: number }
  | { type: 'zoomYAt'; factor: number; anchorY: number }
  | { type: 'zoomYToFit' }

export function initViewportState(
  duration: number,
  bpmRange: { bpmMin: number; bpmMax: number } = { bpmMin: DEFAULT_BPM_MIN, bpmMax: DEFAULT_BPM_MAX },
): ViewportState {
  return {
    viewport: { pxPerSecond: MIN_PX_PER_SECOND, scrollX: 0 },
    bounds: { viewWidth: 0, duration },
    fitted: false,
    bpmViewport: zoomYToFit(),
    bpmBounds: { viewHeight: 0, ...bpmRange },
  }
}

function withBpmViewport(state: ViewportState, bpmViewport: BpmViewport): ViewportState {
  return bpmViewport === state.bpmViewport ? state : { ...state, bpmViewport }
}

function withBpmBounds(state: ViewportState, bpmBounds: BpmBounds): ViewportState {
  return { ...state, bpmBounds, bpmViewport: rebound(state.bpmViewport, state.bpmBounds, bpmBounds) }
}

function withViewport(state: ViewportState, viewport: Viewport): ViewportState {
  return viewport === state.viewport ? state : { ...state, viewport }
}

export function viewportReducer(state: ViewportState, action: ViewportAction): ViewportState {
  switch (action.type) {
    case 'resize': {
      if (action.viewWidth === state.bounds.viewWidth) return state
      const bounds = { ...state.bounds, viewWidth: action.viewWidth }
      if (!state.fitted && action.viewWidth > 0) {
        return { ...state, viewport: zoomToFit(bounds), bounds, fitted: true }
      }
      return { ...state, bounds, viewport: clampViewport(state.viewport, bounds) }
    }
    case 'setDuration': {
      if (action.duration === state.bounds.duration) return state
      const bounds = { ...state.bounds, duration: action.duration }
      return { ...state, bounds, viewport: clampViewport(state.viewport, bounds) }
    }
    case 'scrollBy':
      return withViewport(state, scrollBy(state.viewport, action.dx, state.bounds))
    case 'scrollTo':
      return withViewport(state, scrollTo(state.viewport, action.scrollX, state.bounds))
    case 'zoomAt':
      return withViewport(state, zoomAt(state.viewport, action.factor, action.anchorX, state.bounds))
    case 'zoomToFit':
      return withViewport(state, zoomToFit(state.bounds))
    case 'resizeY':
      if (action.viewHeight === state.bpmBounds.viewHeight) return state
      return withBpmBounds(state, { ...state.bpmBounds, viewHeight: action.viewHeight })
    case 'setBpmRange': {
      const { bpmMin, bpmMax } = action
      if (bpmMin === state.bpmBounds.bpmMin && bpmMax === state.bpmBounds.bpmMax) return state
      return withBpmBounds(state, { ...state.bpmBounds, bpmMin, bpmMax })
    }
    case 'scrollYBy':
      return withBpmViewport(state, scrollYBy(state.bpmViewport, action.dy, state.bpmBounds))
    case 'scrollYTo':
      return withBpmViewport(state, scrollYTo(state.bpmViewport, action.scrollY, state.bpmBounds))
    case 'zoomYAt':
      return withBpmViewport(state, zoomYAt(state.bpmViewport, action.factor, action.anchorY, state.bpmBounds))
    case 'zoomYToFit': {
      const fit = zoomYToFit()
      const same = fit.zoom === state.bpmViewport.zoom && fit.scrollY === state.bpmViewport.scrollY
      return same ? state : withBpmViewport(state, fit)
    }
  }
}
