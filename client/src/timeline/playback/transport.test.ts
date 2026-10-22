import { describe, expect, it } from 'vitest'
import { formatBarBeatStep, formatClock, stepsPerSecond } from './format'
import { INITIAL_TRANSPORT, pause, play, positionAt, rebase, seek, stop } from './transport'
import { TransportClock, type ClockDeps } from './transportClock'

describe('transport', () => {
  it('advances 4 steps per beat at the project BPM', () => {
    const s = play(INITIAL_TRANSPORT, 1000)
    expect(positionAt(s, 1000, 120)).toBe(0)
    expect(positionAt(s, 1500, 120)).toBe(4) // 0.5 s = 1 beat at 120 BPM
    expect(positionAt(s, 1500, 60)).toBe(2) // half the BPM, half the speed
    expect(positionAt(s, 3000, 120)).toBe(16) // 2 s = 1 bar
  })

  it('pause keeps the position, play continues from it', () => {
    let s = play(INITIAL_TRANSPORT, 0)
    s = pause(s, 1000, 120) // 8 steps
    expect(s).toEqual({ playing: false, anchorStep: 8, anchorTimeMs: 1000 })
    expect(positionAt(s, 99999, 120)).toBe(8)
    s = play(s, 5000)
    expect(positionAt(s, 5500, 120)).toBe(12)
  })

  it('stop returns to 0; seek clamps at 0 and keeps playing', () => {
    expect(stop(play(INITIAL_TRANSPORT, 0), 700)).toEqual({ playing: false, anchorStep: 0, anchorTimeMs: 700 })
    const s = seek(play(INITIAL_TRANSPORT, 0), -5, 100)
    expect(s.playing).toBe(true)
    expect(positionAt(s, 600, 120)).toBe(4)
  })

  it('rebase keeps the musical position across a BPM change', () => {
    const s = rebase(play(INITIAL_TRANSPORT, 0), 1000, 120) // at step 8
    expect(positionAt(s, 1000, 60)).toBe(8)
    expect(positionAt(s, 2000, 60)).toBe(12) // continues at the new speed
  })

  it('formats positions', () => {
    expect(formatBarBeatStep(0)).toBe('1.1.1')
    expect(formatBarBeatStep(21.7)).toBe('2.2.2')
    expect(formatClock(16 * 31 + 2, 120)).toBe('1:02.250')
    expect(stepsPerSecond(120)).toBe(8)
  })
})

function fakeDeps() {
  let now = 0
  let next: (() => void) | null = null
  const deps: ClockDeps = {
    now: () => now,
    requestFrame: (cb) => ((next = cb), 1),
    cancelFrame: () => void (next = null),
  }
  /** Advances time and runs the pending animation frame. */
  const advance = (ms: number) => {
    now += ms
    const cb = next
    next = null
    cb?.()
  }
  return { deps, advance, pending: () => next !== null }
}

describe('TransportClock', () => {
  it('pushes the BPM-derived position every frame while playing', () => {
    const { deps, advance } = fakeDeps()
    const clock = new TransportClock(120, 64, deps)
    const frames: number[] = []
    clock.onFrame((step) => frames.push(step))
    clock.play()
    advance(250)
    advance(250)
    expect(frames).toEqual([0, 0, 2, 4])
  })

  it('pauses at the end, and play from the end restarts at 0', () => {
    const { deps, advance, pending } = fakeDeps()
    const clock = new TransportClock(120, 16, deps)
    clock.play()
    advance(2500)
    expect(clock.getState()).toMatchObject({ playing: false, anchorStep: 16 })
    expect(pending()).toBe(false)
    clock.play()
    expect(clock.getPosition()).toBe(0)
    expect(clock.getState().playing).toBe(true)
  })

  it('notifies state subscribers on transport changes only', () => {
    const { deps, advance } = fakeDeps()
    const clock = new TransportClock(120, 64, deps)
    let calls = 0
    clock.subscribe(() => calls++)
    clock.play()
    advance(100)
    advance(100)
    clock.toggle()
    clock.stop()
    clock.stop() // no-op
    expect(calls).toBe(3)
    expect(clock.getPosition()).toBe(0)
  })

  it('seek clamps to the end and detach stops the frame loop', () => {
    const { deps, advance, pending } = fakeDeps()
    const clock = new TransportClock(120, 32, deps)
    clock.seek(100)
    expect(clock.getPosition()).toBe(32)
    clock.seek(8)
    clock.play()
    clock.detach()
    expect(pending()).toBe(false)
    clock.attach()
    advance(500)
    expect(clock.getPosition()).toBe(12)
  })
})
