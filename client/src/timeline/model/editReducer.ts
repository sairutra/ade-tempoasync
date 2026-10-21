import { addNode, setNodeBpm } from './nodes'
import type { TimelineState } from './types'

/** Node indices are offsets from the track's startStep (indices into its bpms). */
export type ModelAction =
  | { type: 'addNode'; trackId: string; index: number }
  | { type: 'setNodeBpm'; trackId: string; index: number; bpm: number }

/**
 * Pure model reducer. Only the edited track gets a new object, so memoized lines of the other
 * tracks don't re-render while a node is dragged.
 */
export function modelReducer(state: TimelineState, action: ModelAction): TimelineState {
  const track = state.tracks[action.trackId]
  if (!track) return state
  const line = { bpms: track.bpms, nodes: track.nodes }
  const next = action.type === 'addNode' ? addNode(line, action.index) : setNodeBpm(line, action.index, action.bpm)
  if (next === line) return state
  return { ...state, tracks: { ...state.tracks, [track.id]: { ...track, ...next } } }
}
