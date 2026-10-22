import { describe, expect, it, vi } from 'vitest'
import { TransportClock, type ClockDeps } from '../playback/transportClock'
import type { ClientMessage } from './protocol'
import { syncTransport } from './transportSync'

function setup() {
  let now = 0
  let frame: (() => void) | null = null
  const deps: ClockDeps = {
    now: () => now,
    requestFrame: (cb) => {
      frame = cb
      return 1
    },
    cancelFrame: () => {
      frame = null
    },
  }
  const clock = new TransportClock(120, 16, deps) // 8 steps per second
  const sent: (ClientMessage | 'flush')[] = []
  const sink = { send: (msg: ClientMessage) => void sent.push(msg), flush: vi.fn(() => void sent.push('flush')) }
  const unsubscribe = syncTransport(clock, sink)
  const advance = (ms: number) => {
    now += ms
    const f = frame
    frame = null
    f?.()
  }
  return { clock, sent, unsubscribe, advance }
}

describe('syncTransport', () => {
  it('sends start on play (after flushing pending patches) and stop on pause', () => {
    const { clock, sent } = setup()
    clock.toggle()
    expect(sent).toEqual(['flush', { type: 'start' }])
    clock.toggle()
    expect(sent.slice(2)).toEqual([{ type: 'stop' }])
  })

  it('sends stop on the stop button, and nothing for a stop or seek that keeps the play state', () => {
    const { clock, sent } = setup()
    clock.play()
    clock.seek(4) // still playing
    clock.stop()
    clock.stop() // already stopped
    clock.seek(2) // still stopped
    expect(sent).toEqual(['flush', { type: 'start' }, { type: 'stop' }])
  })

  it('sends stop when playback reaches the end of the timeline', () => {
    const { clock, sent, advance } = setup()
    clock.play()
    advance(3000) // 24 steps > endStep 16
    expect(clock.getState().playing).toBe(false)
    expect(sent.at(-1)).toEqual({ type: 'stop' })
  })

  it('stops sending after unsubscribe', () => {
    const { clock, sent, unsubscribe } = setup()
    unsubscribe()
    clock.play()
    expect(sent).toEqual([])
  })
})
