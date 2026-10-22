import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mockTimeline } from '../mock/mockTimeline'
import { createEmptyTimelineState, DEFAULT_BPM_MAX, DEFAULT_BPM_MIN } from '../model/selectors'
import { DEFAULT_BPM } from '../model/tempo'
import type { TimelineState } from '../model/types'
import { TimelineProvider, useTimelineModel } from './TimelineProvider'

/** Renders a provider and returns the model its children see. */
function modelFrom(initialState?: TimelineState | null): TimelineState {
  let seen: TimelineState | undefined
  function Probe() {
    seen = useTimelineModel()
    return null
  }
  renderToStaticMarkup(
    <TimelineProvider initialState={initialState}>
      <Probe />
    </TimelineProvider>,
  )
  return seen!
}

describe('TimelineProvider initialState', () => {
  it('starts from an empty model with the default BPMs when omitted', () => {
    expect(modelFrom()).toEqual({ tracks: {}, projectBpm: DEFAULT_BPM, bpmMin: DEFAULT_BPM_MIN, bpmMax: DEFAULT_BPM_MAX })
  })

  it('treats null the same as omitted', () => {
    expect(modelFrom(null)).toEqual(createEmptyTimelineState())
  })

  it('uses the given model when one is passed', () => {
    expect(modelFrom(mockTimeline)).toBe(mockTimeline)
  })
})
