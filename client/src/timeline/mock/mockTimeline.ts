import { createTimelineState } from '../model/selectors'

/** Bass/Keys and Guitar/Vocals share start times, so their header order is alphabetical. */
export const mockTimeline = createTimelineState([
  { id: 'drums', name: 'Drums', start: 0, duration: 60, sourceOffset: 0, y: 0.1, color: '#e07a5f' },
  { id: 'keys', name: 'Keys', start: 8, duration: 46.25, sourceOffset: 0, y: 0.75, color: '#81b29a' },
  { id: 'bass', name: 'Bass', start: 8, duration: 44.5, sourceOffset: 0, y: 0.3, color: '#3d85c6' },
  { id: 'vox', name: 'Vocals', start: 16, duration: 17.4, sourceOffset: 0, y: 0.55, color: '#c48bd6' },
  { id: 'gtr', name: 'Guitar', start: 16, duration: 28, sourceOffset: 0, y: 0.9, color: '#f2cc8f' },
])
