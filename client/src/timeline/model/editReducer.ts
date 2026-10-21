import { addNode, removeNode, setNodeBpm, shiftBpms } from './nodes'
import type { TimelineState, Track } from './types'

/** Node indices are offsets from the track's startStep (indices into its bpms). */
export type ModelAction =
  | { type: 'addNode'; trackId: string; index: number }
  | { type: 'setNodeBpm'; trackId: string; index: number; bpm: number }
  | { type: 'removeNode'; trackId: string; index: number }
  /** Sets the track's points to `base` moved by `delta` BPM (base: the points when the drag began). */
  | { type: 'shiftLine'; trackId: string; base: readonly number[]; delta: number }

type Line = Pick<Track, 'bpms' | 'nodes'>

function apply(line: Line, action: ModelAction): Line {
  switch (action.type) {
    case 'addNode':
      return addNode(line, action.index)
    case 'setNodeBpm':
      return setNodeBpm(line, action.index, action.bpm)
    case 'removeNode':
      return removeNode(line, action.index)
    case 'shiftLine':
      // A base of another length is stale (the line changed since the drag began): ignore it.
      if (action.base.length !== line.bpms.length) return line
      return { bpms: shiftBpms(action.base, action.delta), nodes: line.nodes }
  }
}

/**
 * Pure model reducer. Only the edited track gets a new object, so memoized lines of the other
 * tracks don't re-render while a node is dragged.
 */
export function modelReducer(state: TimelineState, action: ModelAction): TimelineState {
  const track = state.tracks[action.trackId]
  if (!track) return state
  const line = { bpms: track.bpms, nodes: track.nodes }
  const next = apply(line, action)
  if (next === line) return state
  return { ...state, tracks: { ...state.tracks, [track.id]: { ...track, ...next } } }
}
