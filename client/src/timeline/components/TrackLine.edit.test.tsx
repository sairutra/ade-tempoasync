// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../model/types'
import { TrackLine } from './TrackLine'

// Pointer editing in the sync view, where steps aren't evenly spaced on screen.
// 120 BPM project at 100 px/s: one project step is 12.5 px. A flat 90 BPM line's step is 16.67 px.

const flat90: Track = { id: 'f', name: 'Flat', bpms: new Array<number>(65).fill(90), nodes: [0, 16, 64], sourceOffset: 0 }

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 140 }) as DOMRect
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function mount(syncView: boolean) {
  const handlers = {
    onAddNode: vi.fn(),
    onSetNodeBpm: vi.fn(),
    onRemoveNode: vi.fn(),
    onMoveNode: vi.fn(),
    onShiftLine: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onSelect: vi.fn(),
  }
  act(() =>
    root.render(
      <TrackLine
        track={flat90}
        pxPerSecond={100}
        projectBpm={120}
        bpmMin={60}
        bpmMax={200}
        contentEndStep={160}
        syncView={syncView}
        {...handlers}
      />,
    ),
  )
  return handlers
}

const fire = (el: Element, type: string, clientX: number, clientY = 0) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }))
  })

describe('TrackLine editing in the sync view', () => {
  it('adds a node at the line step under the pointer', () => {
    const h = mount(true)
    // line step 8 sounds at 8/6 s = 133.3 px; the step view would read project step 11 there
    fire(container.querySelector('.tl-line-hit')!, 'pointerdown', 134)
    expect(h.onAddNode).toHaveBeenCalledWith('f', 8)
    expect(h.onSelect).toHaveBeenCalledWith('f')
  })

  it('moves a node to the line step under the pointer', () => {
    const h = mount(true)
    const node = container.querySelectorAll('.tl-node')[1] // step 16, at 266.7 px
    expect((node as HTMLElement).style.left).toMatch(/^266\.66/)
    fire(node, 'pointerdown', 267)
    fire(node, 'pointermove', 267 + 133.4) // +8 line steps (the step view would make it +11)
    expect(h.onMoveNode).toHaveBeenLastCalledWith('f', 16, 24)
    fire(node, 'pointerup', 400)
    expect(h.onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('keeps the step view mapping unchanged', () => {
    const h = mount(false)
    fire(container.querySelector('.tl-line-hit')!, 'pointerdown', 134)
    expect(h.onAddNode).toHaveBeenCalledWith('f', 11)
  })
})
