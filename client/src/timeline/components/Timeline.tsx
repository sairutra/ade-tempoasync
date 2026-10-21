import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { getOrderedTracks } from '../model/selectors'
import { stepToTime, timeToStep } from '../model/tempo'
import { useModelActions, useTimelineModel, useTransportClock, useViewport } from '../state/TimelineProvider'
import { contentWidth, visibleTimeRange, xToTime } from '../viewport/viewport'
import { GridCanvas } from './GridCanvas'
import { Playhead } from './Playhead'
import { Ruler } from './Ruler'
import { Scrollbar } from './Scrollbar'
import { TrackHeader } from './TrackHeader'
import { TrackLine } from './TrackLine'
import { TransportBar } from './TransportBar'
import { useWheelZoomScroll } from './useWheelZoomScroll'
import './Timeline.css'

/** Lines this far outside the view stay mounted, so small scrolls don't churn the DOM. */
const OVERSCAN_PX = 200
const ZOOM_STEP = 1.5

export function Timeline() {
  const model = useTimelineModel()
  const { viewport, bounds, actions } = useViewport()
  const clock = useTransportClock()
  const modelActions = useModelActions()

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

  // Space toggles playback, unless a control that handles Space itself has focus.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('button, input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      clock.toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clock])

  // Click or drag on the ruler moves the playhead, snapped to the 16th-note grid.
  const seekToPointer = (e: PointerEvent<HTMLDivElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    clock.seek(Math.max(0, Math.round(timeToStep(xToTime(x, viewport), model.projectBpm))))
  }

  const tracks = getOrderedTracks(model)
  const [, visibleEnd] = visibleTimeRange(viewport, bounds.viewWidth, OVERSCAN_PX)
  const zoomCentered = (factor: number) => actions.zoomAt(factor, bounds.viewWidth / 2)
  const width = contentWidth(viewport.pxPerSecond, bounds)
  // Every line holds its last BPM to the content end, so only its start can be off-screen (right).
  const contentEndStep = timeToStep(bounds.duration, model.projectBpm)

  return (
    <div className="tl-root">
      <TransportBar bpm={model.projectBpm} />
      <div ref={rootRef} className="tl" style={{ '--tl-track-count': tracks.length } as CSSProperties}>
        <div className="tl-toolbar">
          <button type="button" onClick={() => zoomCentered(1 / ZOOM_STEP)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => zoomCentered(ZOOM_STEP)} aria-label="Zoom in">+</button>
          <button type="button" onClick={actions.zoomToFit}>Fit</button>
        </div>
        <div
          className="tl-ruler-wrap"
          title="Click or drag to move the playhead"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            seekToPointer(e)
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToPointer(e)
          }}
        >
          <Ruler viewport={viewport} bpm={model.projectBpm} />
        </div>

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
                        onAddNode={modelActions.addNode}
                        onSetNodeBpm={modelActions.setNodeBpm}
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
        <Playhead viewport={viewport} viewWidth={bounds.viewWidth} bpm={model.projectBpm} scrollTo={actions.scrollTo} />
      </div>
    </div>
  )
}
