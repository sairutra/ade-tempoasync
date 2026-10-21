import { createTimelineState } from '../model/selectors'

export const mockTimeline = createTimelineState(
  [
    { id: 'drums', name: 'Drums' },
    { id: 'bass', name: 'Bass' },
    { id: 'keys', name: 'Keys' },
    { id: 'vox', name: 'Vocals' },
  ],
  [
    { id: 'c1', trackId: 'drums', start: 0, duration: 16, sourceOffset: 0, name: 'Intro beat', color: '#e07a5f' },
    { id: 'c2', trackId: 'drums', start: 16, duration: 24, sourceOffset: 0, name: 'Verse beat', color: '#e07a5f' },
    { id: 'c3', trackId: 'drums', start: 44, duration: 16, sourceOffset: 4, name: 'Outro fill', color: '#e07a5f' },
    { id: 'c4', trackId: 'bass', start: 8, duration: 20, sourceOffset: 0, name: 'Bass A', color: '#3d85c6' },
    { id: 'c5', trackId: 'bass', start: 30, duration: 22.5, sourceOffset: 1.5, name: 'Bass B', color: '#3d85c6' },
    { id: 'c6', trackId: 'keys', start: 4, duration: 12, sourceOffset: 0, name: 'Pad', color: '#81b29a' },
    { id: 'c7', trackId: 'keys', start: 24, duration: 8, sourceOffset: 0, name: 'Stab', color: '#81b29a' },
    { id: 'c8', trackId: 'keys', start: 36.25, duration: 18, sourceOffset: 2, name: 'Chords', color: '#81b29a' },
    { id: 'c9', trackId: 'vox', start: 16, duration: 14, sourceOffset: 0, name: 'Verse vox', color: '#c48bd6' },
    { id: 'c10', trackId: 'vox', start: 33, duration: 0.4, sourceOffset: 0, name: 'Breath', color: '#c48bd6' },
  ],
)
