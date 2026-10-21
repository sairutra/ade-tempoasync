import { Timeline } from './timeline/components/Timeline'
import { TimelineProvider } from './timeline/state/TimelineProvider'

// Starts with an empty timeline. Pass e.g. `initialState={mockTimeline}`
// (from './timeline/mock/mockTimeline') to launch with a prefilled model instead.
export default function App() {
  return (
    <TimelineProvider>
      <Timeline />
    </TimelineProvider>
  )
}
