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

/**
 * Plain reducer so it works with useReducer today and can back a store
 * (e.g. Zustand: set((s) => viewportReducer(s, action))) later.
 */
export type ViewportState = {
  viewport: Viewport
  bounds: ViewportBounds
  /** False until the first real measurement, which triggers an initial zoom-to-fit. */
  fitted: boolean
}

export type ViewportAction =
  | { type: 'resize'; viewWidth: number }
  | { type: 'setDuration'; duration: number }
  | { type: 'scrollBy'; dx: number }
  | { type: 'scrollTo'; scrollX: number }
  | { type: 'zoomAt'; factor: number; anchorX: number }
  | { type: 'zoomToFit' }

export function initViewportState(duration: number): ViewportState {
  return {
    viewport: { pxPerSecond: MIN_PX_PER_SECOND, scrollX: 0 },
    bounds: { viewWidth: 0, duration },
    fitted: false,
  }
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
        return { viewport: zoomToFit(bounds), bounds, fitted: true }
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
  }
}
