import { buildNewTrack, type NewTrackInput } from './newTrack'
import { addNode, moveNode, removeNode, setNodeBpm, shiftBpms } from './nodes'
import { normalizeBpmRange } from './selectors'
import type { TimelineState, Track } from './types'

/** Every line starts at step 0, so node indices (into bpms) and steps are the same numbers. */
export type ModelAction = LineAction | TrackAction | RangeAction

/**
 * Sets the visible BPM range of the lane area (normalized, see normalizeBpmRange). Points outside
 * the new range keep their values and are drawn clamped, as everywhere else.
 */
export type RangeAction = { type: 'setBpmRange'; bpmMin: number; bpmMax: number; edited?: 'min' | 'max' }

/** Adds a track; its colour is made distinct from the existing tracks' (see buildNewTrack). */
export type TrackAction = { type: 'addTrack'; track: NewTrackInput }

export type LineAction =
  | { type: 'addNode'; trackId: string; index: number }
  | { type: 'setNodeBpm'; trackId: string; index: number; bpm: number }
  | { type: 'removeNode'; trackId: string; index: number }
  /** Moves the node at step `fromStep` horizontally to `toStep`, clamped between its neighbours. */
  | { type: 'moveNode'; trackId: string; fromStep: number; toStep: number }
  /** Sets the track's points to `base` moved by `delta` BPM (base: the points when the drag began). */
  | { type: 'shiftLine'; trackId: string; base: readonly number[]; delta: number }

type Line = Pick<Track, 'bpms' | 'nodes'>

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
      if (!line.nodes.includes(action.fromStep)) return line
      return moveNode(line, action.fromStep, action.toStep)
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
  if (action.type === 'setBpmRange') {
    const range = normalizeBpmRange(action.bpmMin, action.bpmMax, action.edited)
    if (!range || (range.bpmMin === state.bpmMin && range.bpmMax === state.bpmMax)) return state
    return { ...state, ...range }
  }
  if (action.type === 'addTrack') {
    const track = buildNewTrack(state, action.track)
    return { ...state, tracks: { ...state.tracks, [track.id]: track } }
  }
  const track = state.tracks[action.trackId]
  if (!track) return state
  const line = { bpms: track.bpms, nodes: track.nodes }
  const next = apply(line, action)
  if (next.bpms === line.bpms && next.nodes === line.nodes) return state
  return { ...state, tracks: { ...state.tracks, [track.id]: { ...track, ...next } } }
}
