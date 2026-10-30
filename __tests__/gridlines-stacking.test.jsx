// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { render } from '@testing-library/react'
import Gridlines from '../Components/Gridlines'

/**
 * After Kevin's CSS zoom, the PDF canvas is `absolute` and occupies the same
 * box as Gridlines. Tailwind has no `z-5` utility (scale is z-0, z-10, …),
 * so the class is a no-op. The PDF is later in the DOM with auto z-index and
 * paints over the drawing/snap grid.
 */
beforeAll(() => {
    class FakePath2D {
        constructor() {}
    }
    global.Path2D = FakePath2D
    HTMLCanvasElement.prototype.getContext = () => ({
        clearRect() {},
        stroke() {},
        beginPath() {},
        lineWidth: 0,
    })
})

describe('drawing/snap grid stacking (Gridlines vs PDF)', () => {
    it('keeps Gridlines above the PDF with a real z-index and no hit-testing', () => {
        const { container } = render(
            <Gridlines
                pixelsPerMesh={10}
                dimensions={{ width: 200, height: 100 }}
                hasScale
                zoom={1}
            />,
        )
        const canvas = container.querySelector('canvas')
        const classes = canvas.className.split(/\s+/)
        expect(classes).toContain('pointer-events-none')
        expect(canvas.className).toMatch(/z-\[5\]/)
        expect(classes).not.toContain('z-5')
    })

    it('pins the plan PDF at z-0 so the grid can sit above it', () => {
        const src = readFileSync(path.join(process.cwd(), 'pages/index.jsx'), 'utf8')
        expect(src).toMatch(
            /className=\{selectedFile \? 'absolute top-0 left-0 z-0 block pointer-events-none' : 'hidden'\}/,
        )
    })
})
