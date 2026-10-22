import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Track } from '../model/types'
import { TrackLine } from './TrackLine'

const track: Track = { id: 'a', name: 'Lead', bpms: [120, 250, 100], nodes: [0, 1, 2], sourceOffset: 0, color: '#123456' }
const noop = () => {}
const props = { track, projectBpm: 120, bpmMin: 60, bpmMax: 200, contentEndStep: 32, onAddNode: noop, onSetNodeBpm: noop, onRemoveNode: noop, onMoveNode: noop, onShiftLine: noop, onDragStart: noop, onDragEnd: noop }
const render = (pxPerSecond: number) => renderToStaticMarkup(<TrackLine {...props} pxPerSecond={pxPerSecond} />)

describe('TrackLine', () => {
  it('draws one svg from step 0 to the timeline end, with a model-unit viewBox and a clamped path', () => {
    const html = render(100)
    expect(html.match(/<svg/g)).toHaveLength(1)
    expect(html.match(/class="tl-line-hit"/g)).toHaveLength(1)
    expect(html).toContain('viewBox="0 0 32 140"') // 32 steps wide, 200 - 60 BPM tall
    expect(html).toContain('preserveAspectRatio="none"')
    expect(html).toContain('vector-effect="non-scaling-stroke"')
    expect(html.match(/d="M0 80 L1 0 L2 100 H32"/g)).toHaveLength(2) // 250 clamped to the top; line + hit path
    expect(html).not.toContain('translateX') // every line starts at the left edge
    expect(html).toContain('width:400px') // 32 steps = 4 s
  })

  it('zoom changes only the placement and width, not the path or viewBox', () => {
    const strip = (html: string) => html.replace(/translate[^;"]*|width:[\d.]+px|left:[\d.]+px| data-dense="true"/g, '')
    expect(strip(render(37))).toBe(strip(render(500)))
  })

  it('puts the label at the first point', () => {
    expect(render(100)).toMatch(/class="tl-line-name"[^>]*top:57\.1428/) // (200 - 120) / 140
  })

  it('draws one handle per node at its step and BPM', () => {
    const html = render(100)
    const nodes = [...html.matchAll(/class="tl-node"[^>]*style="([^"]*)"/g)].map((m) => m[1])
    expect(nodes).toHaveLength(3)
    // each step is 12.5 px at 100 px/s; 250 BPM drawn at the top
    expect(nodes[0]).toMatch(/left:0;top:57\.14/)
    expect(nodes[1]).toMatch(/left:12\.5px;top:0%/)
    expect(nodes[2]).toMatch(/left:25px;top:71\.42/)
  })
})
