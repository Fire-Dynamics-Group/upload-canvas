import { describe, it, expect } from 'vitest'
import { clientToCanvasPoint } from '../utils/helperFunctions'

// Issue #16 — pointer events must map to canvas-INTRINSIC coordinates so a click
// lands on the intended canvas pixel even when the canvas is displayed at a CSS
// size different from its intrinsic width/height (responsive fit, browser zoom,
// a small device shrinking the ~3576 px bitmap).

const rectAt = (left, top, width, height) => ({ left, top, width, height })

describe('clientToCanvasPoint', () => {
    it('is identity at 1:1 display (CSS size == intrinsic size, origin at 0,0)', () => {
        const rect = rectAt(0, 0, 1000, 800)
        expect(clientToCanvasPoint({ clientX: 250, clientY: 400 }, rect, 1000, 800))
            .toEqual({ x: 250, y: 400 })
    })

    it('scales up when the canvas is shrunk to fit (CSS smaller than intrinsic)', () => {
        // 1000px intrinsic bitmap shown at 500 CSS px -> each CSS px = 2 canvas px.
        const rect = rectAt(0, 0, 500, 400)
        expect(clientToCanvasPoint({ clientX: 250, clientY: 200 }, rect, 1000, 800))
            .toEqual({ x: 500, y: 400 })
    })

    it('subtracts the canvas origin (rect.left/top) before scaling', () => {
        // Canvas offset 100px right / 50px down, displayed at half size.
        const rect = rectAt(100, 50, 500, 400)
        expect(clientToCanvasPoint({ clientX: 350, clientY: 250 }, rect, 1000, 800))
            .toEqual({ x: 500, y: 400 })
    })

    it('handles browser zoom (CSS larger than intrinsic) by scaling down', () => {
        const rect = rectAt(0, 0, 2000, 1600)
        expect(clientToCanvasPoint({ clientX: 1000, clientY: 800 }, rect, 1000, 800))
            .toEqual({ x: 500, y: 400 })
    })

    it('falls back to no scaling when the rect has zero size (degenerate)', () => {
        const rect = rectAt(0, 0, 0, 0)
        expect(clientToCanvasPoint({ clientX: 30, clientY: 40 }, rect, 1000, 800))
            .toEqual({ x: 30, y: 40 })
    })
})
