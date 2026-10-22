import { buildNewTrack, type NewTrackInput } from './newTrack'
import { addNode, moveNode, removeNode, setNodeBpm, shiftBpms } from './nodes'
import { normalizeBpmRange } from './selectors'
import { isValidSequence } from './sequence'
import type { TimelineState, Track } from './types'

/** Every line starts at step 0, so node indices (into bpms) and steps are the same numbers. */
export type ModelAction = LineAction | TrackAction | RangeAction

/**
 * Sets the visible BPM range of the lane area (normalized, see normalizeBpmRange). Points outside
 * the new range keep their values and are drawn clamped, as everywhere else.
 */
export type RangeAction = { type: 'setBpmRange'; bpmMin: number; bpmMax: number; edited?: 'min' | 'max' }

/**
 * Track data the edit dialog can change. Only the sequence for now; name, colour and channel can be
 * added here later (the backend sync would need messages for them too).
 */
export type TrackEdit = { sequence?: number[] }

export type TrackAction =
  /** Adds a track; its colour is made distinct from the existing tracks' (see buildNewTrack). */
  | { type: 'addTrack'; track: NewTrackInput }
  /** Applies `changes` to a track. Invalid values are ignored (the dialog validates first). */
  | { type: 'editTrack'; trackId: string; changes: TrackEdit }

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
  if (action.type === 'editTrack') return editTrack(state, action.trackId, action.changes)
  const track = state.tracks[action.trackId]
  if (!track) return state
  const line = { bpms: track.bpms, nodes: track.nodes }
  const next = apply(line, action)
  if (next.bpms === line.bpms && next.nodes === line.nodes) return state
  return { ...state, tracks: { ...state.tracks, [track.id]: { ...track, ...next } } }
}

function sameSequence(a: readonly number[] | undefined, b: readonly number[]): boolean {
  return a !== undefined && a.length === b.length && a.every((v, i) => v === b[i])
}

/** A new track object (and `sequence` array) only when something actually changes. */
function editTrack(state: TimelineState, trackId: string, changes: TrackEdit): TimelineState {
  const track = state.tracks[trackId]
  if (!track) return state
  const { sequence } = changes
  if (sequence === undefined || !isValidSequence(sequence) || sameSequence(track.sequence, sequence)) return state
  return { ...state, tracks: { ...state.tracks, [trackId]: { ...track, sequence: sequence.slice() } } }
}
