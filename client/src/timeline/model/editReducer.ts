import { buildNewTrack, type NewTrackInput } from './newTrack'
import { addNode, moveNode, removeNode, setNodeBpm, shiftBpms } from './nodes'
import type { TimelineState, Track } from './types'

/**
 * Node indices are offsets from the track's startStep (indices into its bpms). moveNode is the
 * exception: it uses absolute steps, because moving the first node changes startStep mid-drag.
 */
export type ModelAction = LineAction | TrackAction

/** Adds a track; its colour is made distinct from the existing tracks' (see buildNewTrack). */
export type TrackAction = { type: 'addTrack'; track: NewTrackInput }

export type LineAction =
  | { type: 'addNode'; trackId: string; index: number }
  | { type: 'setNodeBpm'; trackId: string; index: number; bpm: number }
  | { type: 'removeNode'; trackId: string; index: number }
  /** Moves the node at absolute step `fromStep` horizontally to `toStep`, clamped between its neighbours. */
  | { type: 'moveNode'; trackId: string; fromStep: number; toStep: number }
  /** Sets the track's points to `base` moved by `delta` BPM (base: the points when the drag began). */
  | { type: 'shiftLine'; trackId: string; base: readonly number[]; delta: number }

type Line = Pick<Track, 'startStep' | 'bpms' | 'nodes'>

function apply(line: Line, action: LineAction): Line {
  switch (action.type) {
    case 'addNode':
      return { ...line, ...addNode(line, action.index) }
    case 'setNodeBpm':
      return { ...line, ...setNodeBpm(line, action.index, action.bpm) }
    case 'removeNode':
      return { ...line, ...removeNode(line, action.index) }
    case 'moveNode': {
      // A step that is no longer a node is stale (the line changed since the drag began): ignore it.
      const index = action.fromStep - line.startStep
      if (!line.nodes.includes(index)) return line
      return moveNode(line, index, action.toStep)
    }
    case 'shiftLine':
      // A base of another length is stale (the line changed since the drag began): ignore it.
      if (action.base.length !== line.bpms.length) return line
      return { ...line, bpms: shiftBpms(action.base, action.delta) }
  }
}

/**
 * Pure model reducer. Only the edited track gets a new object, so memoized lines of the other
 * tracks don't re-render while a node is dragged.
 */
export function modelReducer(state: TimelineState, action: ModelAction): TimelineState {
  if (action.type === 'addTrack') {
    const track = buildNewTrack(state, action.track)
    return { ...state, tracks: { ...state.tracks, [track.id]: track } }
  }
  const track = state.tracks[action.trackId]
  if (!track) return state
  const line = { startStep: track.startStep, bpms: track.bpms, nodes: track.nodes }
  const next = apply(line, action)
  if (next.startStep === line.startStep && next.bpms === line.bpms && next.nodes === line.nodes) return state
  return { ...state, tracks: { ...state.tracks, [track.id]: { ...track, ...next } } }
}
