import { useEffect, useRef, type CSSProperties } from 'react'
import { getOrderedTracks } from '../model/selectors'
import { stepToTime, timeToStep } from '../model/tempo'
import { useTimelineModel, useViewport } from '../state/TimelineProvider'
import { contentWidth, visibleTimeRange } from '../viewport/viewport'
import { GridCanvas } from './GridCanvas'
import { Ruler } from './Ruler'
import { Scrollbar } from './Scrollbar'
import { TrackHeader } from './TrackHeader'
import { TrackLine } from './TrackLine'
import { useWheelZoomScroll } from './useWheelZoomScroll'
import './Timeline.css'

/** Lines this far outside the view stay mounted, so small scrolls don't churn the DOM. */
const OVERSCAN_PX = 200
const ZOOM_STEP = 1.5

export function Timeline() {
  const model = useTimelineModel()
  const { viewport, bounds, actions } = useViewport()

  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)

  // The lane area's width is the viewport width; it drives clamping and zoom-to-fit.
  useEffect(() => {
    const lanes = lanesRef.current!
    const observer = new ResizeObserver(() => actions.resize(lanes.clientWidth))
    observer.observe(lanes)
    return () => observer.disconnect()
  }, [actions])

  useWheelZoomScroll(rootRef, lanesRef, bodyRef, actions)

  const tracks = getOrderedTracks(model)
  const [, visibleEnd] = visibleTimeRange(viewport, bounds.viewWidth, OVERSCAN_PX)
  const zoomCentered = (factor: number) => actions.zoomAt(factor, bounds.viewWidth / 2)
  const width = contentWidth(viewport.pxPerSecond, bounds)
  // Every line holds its last BPM to the content end, so only its start can be off-screen (right).
  const contentEndStep = timeToStep(bounds.duration, model.projectBpm)

  return (
    <div ref={rootRef} className="tl" style={{ '--tl-track-count': tracks.length } as CSSProperties}>
      <div className="tl-toolbar">
        <button type="button" onClick={() => zoomCentered(1 / ZOOM_STEP)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => zoomCentered(ZOOM_STEP)} aria-label="Zoom in">+</button>
        <button type="button" onClick={actions.zoomToFit}>Fit</button>
      </div>
      <Ruler viewport={viewport} bpm={model.projectBpm} />

      <div className="tl-body-wrap">
        <GridCanvas viewport={viewport} bpm={model.projectBpm} />
        <div ref={bodyRef} className="tl-body">
          <div className="tl-headers">
            {tracks.map((track) => (
              <TrackHeader key={track.id} track={track} />
            ))}
          </div>
          <div ref={lanesRef} className="tl-lanes">
            {/* One transform for scroll; lines are positioned in content space (see timeToContentX). */}
            <div
              className="tl-lanes-content"
              style={{ width: Math.max(width, bounds.viewWidth), transform: `translateX(${-viewport.scrollX}px)` }}
            >
              <div className="tl-lines">
                {tracks.map((track) =>
                  stepToTime(track.startStep, model.projectBpm) > visibleEnd ? null : (
                    <TrackLine
                      key={track.id}
                      track={track}
                      pxPerSecond={viewport.pxPerSecond}
                      projectBpm={model.projectBpm}
                      bpmMin={model.bpmMin}
                      bpmMax={model.bpmMax}
                      contentEndStep={contentEndStep}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tl-scrollbar-spacer" />
      <Scrollbar
        scrollX={viewport.scrollX}
        contentWidth={width}
        onScroll={actions.scrollTo}
      />
    </div>
  )
}
