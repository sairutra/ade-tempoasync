import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Track } from '../model/types'
import { TrackLine } from './TrackLine'

const track: Track = { id: 'a', name: 'Lead', startStep: 16, bpms: [120, 250, 100], sourceOffset: 0, color: '#123456' }
const props = { track, projectBpm: 120, bpmMin: 60, bpmMax: 200, contentEndStep: 48 }
const render = (pxPerSecond: number) => renderToStaticMarkup(<TrackLine {...props} pxPerSecond={pxPerSecond} />)

describe('TrackLine', () => {
  it('draws one svg at the start step, with a model-unit viewBox and a clamped path', () => {
    const html = render(100)
    expect(html.match(/<svg/g)).toHaveLength(1)
    expect(html).toContain('viewBox="0 0 32 140"') // 48 - 16 steps wide, 200 - 60 BPM tall
    expect(html).toContain('preserveAspectRatio="none"')
    expect(html).toContain('vector-effect="non-scaling-stroke"')
    expect(html).toContain('d="M0 80 L1 0 L2 100 H32"') // 250 clamped to the top
    expect(html).toContain('translateX(200px)') // step 16 = 2 s at 120 BPM, × 100 px/s
    expect(html).toContain('width:400px') // 32 steps = 4 s
  })

  it('zoom changes only the placement and width, not the path or viewBox', () => {
    const strip = (html: string) => html.replace(/translate[^;"]*|width:[\d.]+px/g, '')
    expect(strip(render(37))).toBe(strip(render(500)))
  })

  it('puts the label at the first point', () => {
    expect(render(100)).toMatch(/class="tl-line-name"[^>]*top:57\.1428/) // (200 - 120) / 140
  })
})
