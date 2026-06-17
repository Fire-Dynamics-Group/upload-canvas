import { describe, it, expect } from 'vitest'
import { computeFramingScroll, elementPixelBox } from '../utils/viewportFraming'

// When a specific element (e.g. a door) is being configured in the docked
// panel, the app scrolls so the element lands in the visible area NOT occluded
// by the panel. computeFramingScroll is the pure calculation; the wiring
// (window.scrollTo today, canvas pan/zoom later) swaps underneath it.

const viewport = { width: 1000, height: 800 }

describe('computeFramingScroll', () => {
    it('centers the element in the clear region left of a right-docked panel', () => {
        // panel 400 wide on the right -> clear region is 0..600, centre at 300.
        const box = { x: 500, y: 300, width: 100, height: 100 } // centre (550, 350)
        const { left } = computeFramingScroll(box, viewport, { side: 'right', width: 400 })
        // left = centreX(550) - clearCentre(300) = 250
        expect(left).toBe(250)
    })

    it('centers in the clear region right of a left-docked panel', () => {
        // panel 400 on the left -> clear 400..1000, centre at 700.
        const box = { x: 500, y: 0, width: 100, height: 100 } // centreX 550
        const { left } = computeFramingScroll(box, viewport, { side: 'left', width: 400 })
        // left = 550 - 700 = -150 -> clamped to 0
        expect(left).toBe(0)
    })

    it('centers in the full viewport when there is no panel', () => {
        const box = { x: 800, y: 0, width: 0, height: 0 } // centreX 800
        const { left } = computeFramingScroll(box, viewport, null)
        // left = 800 - 500 = 300
        expect(left).toBe(300)
    })

    it('vertically centers the element (clamped at 0)', () => {
        const box = { x: 0, y: 1200, width: 0, height: 0 } // centreY 1200
        const { top } = computeFramingScroll(box, viewport, { side: 'right', width: 400 })
        expect(top).toBe(800) // 1200 - 400
        const near = computeFramingScroll({ x: 0, y: 100, width: 0, height: 0 }, viewport, null)
        expect(near.top).toBe(0) // 100 - 400 -> clamped
    })
})

describe('elementPixelBox', () => {
    it('returns a zero-size box at a single point (e.g. a fire/sensor)', () => {
        expect(elementPixelBox({ points: [{ x: 30, y: 40 }] }))
            .toEqual({ x: 30, y: 40, width: 0, height: 0 })
    })

    it('returns the bounding box over a polyline/door points', () => {
        const door = { points: [{ x: 10, y: 50 }, { x: 60, y: 20 }] }
        expect(elementPixelBox(door)).toEqual({ x: 10, y: 20, width: 50, height: 30 })
    })

    it('is defensive against missing points', () => {
        expect(elementPixelBox(null)).toBeNull()
        expect(elementPixelBox({})).toBeNull()
        expect(elementPixelBox({ points: [] })).toBeNull()
    })
})
