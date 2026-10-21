import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { modelReducer } from '../model/editReducer'
import { getTimelineDuration } from '../model/selectors'
import { timeToStep } from '../model/tempo'
import type { TimelineState } from '../model/types'
import { TransportClock } from '../playback/transportClock'
import { initViewportState, viewportReducer, type ViewportState } from '../viewport/viewportReducer'

/**
 * Thin React wiring around the plain-TS model and viewport reducer.
 * Separate contexts so model-only consumers (track headers) don't re-render on scroll/zoom.
 * The transport clock is a stable object in its own context: playback never re-renders the tree.
 * Swapping in a store later means replacing these hooks' bodies, not the components.
 */

export type ViewportActions = {
  resize: (viewWidth: number) => void
  scrollBy: (dx: number) => void
  scrollTo: (scrollX: number) => void
  zoomAt: (factor: number, anchorX: number) => void
  zoomToFit: () => void
}

/** Node indices are offsets from the track's startStep. Stable for the provider's lifetime. */
export type ModelActions = {
  addNode: (trackId: string, index: number) => void
  setNodeBpm: (trackId: string, index: number, bpm: number) => void
  removeNode: (trackId: string, index: number) => void
  /** Moves a node horizontally; steps are absolute (not offsets), clamped between its neighbours. */
  moveNode: (trackId: string, fromStep: number, toStep: number) => void
  /** Sets the track's points to `base` moved by `delta` BPM. */
  shiftLine: (trackId: string, base: readonly number[], delta: number) => void
}

type ViewportContextValue = ViewportState & { actions: ViewportActions }

const ModelContext = createContext<TimelineState | null>(null)
const ModelActionsContext = createContext<ModelActions | null>(null)
const ViewportContext = createContext<ViewportContextValue | null>(null)
const ClockContext = createContext<TransportClock | null>(null)

export function TimelineProvider({ initialState, children }: { initialState: TimelineState; children: ReactNode }) {
  // Undo can wrap this reducer later (past/present/future) without touching the components.
  const [model, modelDispatch] = useReducer(modelReducer, initialState)
  const modelActions = useMemo<ModelActions>(
    () => ({
      addNode: (trackId, index) => modelDispatch({ type: 'addNode', trackId, index }),
      setNodeBpm: (trackId, index, bpm) => modelDispatch({ type: 'setNodeBpm', trackId, index, bpm }),
      removeNode: (trackId, index) => modelDispatch({ type: 'removeNode', trackId, index }),
      moveNode: (trackId, fromStep, toStep) => modelDispatch({ type: 'moveNode', trackId, fromStep, toStep }),
      shiftLine: (trackId, base, delta) => modelDispatch({ type: 'shiftLine', trackId, base, delta }),
    }),
    [],
  )
  const duration = useMemo(() => getTimelineDuration(model), [model])
  const [viewportState, dispatch] = useReducer(viewportReducer, duration, initViewportState)

  useEffect(() => dispatch({ type: 'setDuration', duration }), [duration])

  // Playback runs at the project BPM up to the end of the scrollable timeline.
  const endStep = timeToStep(duration, model.projectBpm)
  const [clock] = useState(() => new TransportClock(model.projectBpm, endStep))
  useEffect(() => clock.setBpm(model.projectBpm), [clock, model.projectBpm])
  useEffect(() => clock.setEndStep(endStep), [clock, endStep])
  useEffect(() => {
    clock.attach()
    return () => clock.detach()
  }, [clock])

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
      <ModelActionsContext.Provider value={modelActions}>
        <ViewportContext.Provider value={viewportValue}>
          <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>
        </ViewportContext.Provider>
      </ModelActionsContext.Provider>
    </ModelContext.Provider>
  )
}

export function useTimelineModel(): TimelineState {
  const model = useContext(ModelContext)
  if (!model) throw new Error('useTimelineModel must be used inside <TimelineProvider>')
  return model
}

export function useModelActions(): ModelActions {
  const actions = useContext(ModelActionsContext)
  if (!actions) throw new Error('useModelActions must be used inside <TimelineProvider>')
  return actions
}

export function useViewport(): ViewportContextValue {
  const value = useContext(ViewportContext)
  if (!value) throw new Error('useViewport must be used inside <TimelineProvider>')
  return value
}

/** The transport clock (stable for the provider's lifetime). Use onFrame for per-frame drawing. */
export function useTransportClock(): TransportClock {
  const clock = useContext(ClockContext)
  if (!clock) throw new Error('useTransportClock must be used inside <TimelineProvider>')
  return clock
}

/** Re-renders only on play/pause, not per frame. */
export function useIsPlaying(): boolean {
  const clock = useTransportClock()
  return useSyncExternalStore(clock.subscribe, () => clock.getState().playing)
}
