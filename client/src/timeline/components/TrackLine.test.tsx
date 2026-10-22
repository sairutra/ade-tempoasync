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

describe('TrackLine in sync view', () => {
  const flat = (bpm: number, steps: number): Track => ({
    id: 'f',
    name: 'Flat',
    bpms: new Array<number>(steps).fill(bpm),
    nodes: [0, steps - 1],
    sourceOffset: 0,
  })
  const renderSync = (t: Track, pxPerSecond = 100) =>
    renderToStaticMarkup(<TrackLine {...props} track={t} pxPerSecond={pxPerSecond} syncView />)
  const strip = (html: string) => html.replace(/<span class="tl-line-tick"[^>]*><\/span>/g, '')

  it('draws a line at the project tempo exactly as the step view does', () => {
    const t = flat(120, 17)
    const step = renderToStaticMarkup(<TrackLine {...props} track={t} pxPerSecond={100} />)
    expect(strip(renderSync(t))).toBe(step)
  })

  it('places a 90 BPM line at its real onsets', () => {
    const html = renderSync(flat(90, 17))
    // step 16 sounds at 8/3 s = 21.333 project steps at 120 BPM
    expect(html).toContain('d="M0 110 L1.3333 110')
    expect(html).toContain('L21.3333 110 H32"')
    const nodes = [...html.matchAll(/class="tl-node"[^>]*style="([^"]*)"/g)].map((m) => m[1])
    expect(nodes[1]).toMatch(/left:266\.66/) // 8/3 s at 100 px/s
  })

  it('ticks beats and marks downbeats on project bars as in sync', () => {
    const html = renderSync(flat(90, 1), 100) // 32 project steps = 4 s
    const ticks = [...html.matchAll(/class="tl-line-tick"([^>]*)/g)].map((m) => m[1])
    // beats every 2/3 s up to 4 s: 0, 0.67 … 4 → 7 ticks; downbeats at 0 and 2.67
    expect(ticks).toHaveLength(7)
    expect(ticks.filter((t) => t.includes('data-level="bar"'))).toHaveLength(2)
    expect(ticks.filter((t) => t.includes('data-sync'))).toHaveLength(1) // only step 0
  })

  it('draws no ticks in the step view', () => {
    expect(render(100)).not.toContain('tl-line-tick')
  })
})
