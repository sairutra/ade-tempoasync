import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Track } from '../model/types'
import { TrackHeader } from './TrackHeader'

const track: Track = { id: 'a', name: 'Lead', bpms: [120], nodes: [0], sourceOffset: 0, color: '#123456' }

describe('TrackHeader', () => {
  it('shows a swatch driven by the same --tl-line-color the track line uses', () => {
    const html = renderToStaticMarkup(<TrackHeader track={track} />)
    expect(html).toContain('--tl-line-color:#123456')
    expect(html).toContain('class="tl-track-swatch"')
  })

  it('leaves the variable unset without a colour, so the swatch falls back like the line', () => {
    const html = renderToStaticMarkup(<TrackHeader track={{ ...track, color: undefined }} />)
    expect(html).not.toContain('--tl-line-color')
    expect(html).toContain('class="tl-track-swatch"')
  })
})
