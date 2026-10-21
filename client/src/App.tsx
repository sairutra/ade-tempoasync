import { mockTimeline } from './timeline/mock/mockTimeline'
import { Timeline } from './timeline/components/Timeline'
import { TimelineProvider } from './timeline/state/TimelineProvider'

export default function App() {
  return (
    <TimelineProvider initialState={mockTimeline}>
      <Timeline />
    </TimelineProvider>
  )
}
