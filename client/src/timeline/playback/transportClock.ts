import * as T from './transport'
import type { TransportState } from './transport'

export type ClockDeps = {
  now: () => number
  requestFrame: (cb: () => void) => number
  cancelFrame: (id: number) => void
}

const browserDeps: ClockDeps = {
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
}

export type FrameListener = (step: number, playing: boolean) => void

/**
 * Non-React owner of the transport: holds TransportState, runs one requestAnimationFrame loop
 * while playing, and pushes the playhead step to frame listeners. Components draw the playhead
 * imperatively from those callbacks, so playback never re-renders React.
 *
 * Two kinds of subscribers:
 * - `subscribe`: notified when the transport state changes (play/pause/stop/seek). Fits
 *   useSyncExternalStore, for UI that only cares whether it is playing.
 * - `onFrame`: called with the current step every frame while playing, and once after every
 *   state change (so a seek while paused still moves the playhead).
 *
 * Playback runs from the playhead to `endStep` and pauses there; play at the end restarts from 0.
 */
export class TransportClock {
  private state: TransportState = T.INITIAL_TRANSPORT
  private bpm: number
  private endStep: number
  private readonly deps: ClockDeps
  private readonly listeners = new Set<() => void>()
  private readonly frameListeners = new Set<FrameListener>()
  private frame = 0
  private attached = true

  constructor(bpm: number, endStep: number, deps: ClockDeps = browserDeps) {
    this.bpm = bpm
    this.endStep = endStep
    this.deps = deps
  }

  getState = (): TransportState => this.state
  getBpm = (): number => this.bpm
  getPosition = (): number => Math.min(this.endStep, T.positionAt(this.state, this.deps.now(), this.bpm))

  play = () => {
    const at = this.state.anchorStep >= this.endStep ? T.seek(this.state, 0, this.deps.now()) : this.state
    this.set(T.play(at, this.deps.now()))
  }
  pause = () => this.set(T.pause(this.state, this.deps.now(), this.bpm))
  toggle = () => (this.state.playing ? this.pause() : this.play())
  stop = () => this.set(T.stop(this.state, this.deps.now()))
  seek = (step: number) => this.set(T.seek(this.state, Math.min(step, this.endStep), this.deps.now()))

  setBpm(bpm: number) {
    if (bpm === this.bpm) return
    this.state = T.rebase(this.state, this.deps.now(), this.bpm)
    this.bpm = bpm
    this.emitFrame()
  }

  setEndStep(endStep: number) {
    if (endStep === this.endStep) return
    this.endStep = endStep
    if (this.state.anchorStep > endStep) this.seek(endStep)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  onFrame(listener: FrameListener) {
    this.frameListeners.add(listener)
    listener(this.getPosition(), this.state.playing)
    return () => void this.frameListeners.delete(listener)
  }

  /** Stops the frame loop (e.g. on unmount); `attach` resumes it if still playing. */
  detach() {
    this.attached = false
    this.deps.cancelFrame(this.frame)
    this.frame = 0
  }

  attach() {
    this.attached = true
    this.schedule()
  }

  private set(next: TransportState) {
    if (next === this.state) return
    this.state = next
    for (const l of this.listeners) l()
    this.emitFrame()
    this.schedule()
  }

  private emitFrame() {
    const step = this.getPosition()
    for (const l of this.frameListeners) l(step, this.state.playing)
  }

  private schedule() {
    if (this.attached && this.state.playing && !this.frame) this.frame = this.deps.requestFrame(this.tick)
  }

  private tick = () => {
    this.frame = 0
    if (!this.state.playing) return
    const now = this.deps.now()
    if (T.positionAt(this.state, now, this.bpm) >= this.endStep) {
      this.set({ playing: false, anchorStep: this.endStep, anchorTimeMs: now })
      return
    }
    this.emitFrame()
    this.schedule()
  }
}
