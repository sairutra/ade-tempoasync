import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { getTimelineDuration } from '../model/selectors'
import type { TimelineState } from '../model/types'
import { initViewportState, viewportReducer, type ViewportState } from '../viewport/viewportReducer'

/**
 * Thin React wiring around the plain-TS model and viewport reducer.
 * Two contexts so model-only consumers (track headers) don't re-render on scroll/zoom.
 * Swapping in a store later means replacing these hooks' bodies, not the components.
 */

export type ViewportActions = {
  resize: (viewWidth: number) => void
  scrollBy: (dx: number) => void
  scrollTo: (scrollX: number) => void
  zoomAt: (factor: number, anchorX: number) => void
  zoomToFit: () => void
}

type ViewportContextValue = ViewportState & { actions: ViewportActions }

const ModelContext = createContext<TimelineState | null>(null)
const ViewportContext = createContext<ViewportContextValue | null>(null)

export function TimelineProvider({ initialState, children }: { initialState: TimelineState; children: ReactNode }) {
  // Read-only for milestones 1–2; editing (milestone 3) adds a model reducer + undo stack here.
  const [model] = useState(initialState)
  const duration = useMemo(() => getTimelineDuration(model), [model])
  const [viewportState, dispatch] = useReducer(viewportReducer, duration, initViewportState)

  useEffect(() => dispatch({ type: 'setDuration', duration }), [duration])

  const actions = useMemo<ViewportActions>(
    () => ({
      resize: (viewWidth) => dispatch({ type: 'resize', viewWidth }),
      scrollBy: (dx) => dispatch({ type: 'scrollBy', dx }),
      scrollTo: (scrollX) => dispatch({ type: 'scrollTo', scrollX }),
      zoomAt: (factor, anchorX) => dispatch({ type: 'zoomAt', factor, anchorX }),
      zoomToFit: () => dispatch({ type: 'zoomToFit' }),
    }),
    [],
  )

  const viewportValue = useMemo(() => ({ ...viewportState, actions }), [viewportState, actions])

  return (
    <ModelContext.Provider value={model}>
      <ViewportContext.Provider value={viewportValue}>{children}</ViewportContext.Provider>
    </ModelContext.Provider>
  )
}

export function useTimelineModel(): TimelineState {
  const model = useContext(ModelContext)
  if (!model) throw new Error('useTimelineModel must be used inside <TimelineProvider>')
  return model
}

export function useViewport(): ViewportContextValue {
  const value = useContext(ViewportContext)
  if (!value) throw new Error('useViewport must be used inside <TimelineProvider>')
  return value
}
