import { describe, it, expect } from 'vitest'
import { applyGridFallback } from '../Components/Canvas'

// Locks in the 4-line pattern that was inlined three times in
// Canvas.jsx's handleMouseMove (mesh-rect, non-mesh-rect, polyline-hover).
// Step 1 of docs/first-click-feedback.md: extract with no behaviour change.
//
// Rule: on any axis where the snap layer produced a guide, use the snapped
// coordinate. On any axis with no guide, quantise the raw cursor to the grid.

const GRID = 33.6

describe('applyGridFallback', () => {
    it('uses snapped x when a vertical guide fired, snapped y when a horizontal guide fired', () => {
        const raw = { x: 100.7, y: 200.3 }
        const snapped = { x: 99, y: 201 }
        const guides = [
            { type: 'vertical', x: 99 },
            { type: 'horizontal', y: 201 },
        ]
        expect(applyGridFallback({ raw, snapped, guides, pixelsPerMesh: GRID })).toEqual({ x: 99, y: 201 })
    })

    it('quantises raw x to the grid when no vertical guide fired', () => {
        const raw = { x: 50, y: 200 }
        const snapped = { x: 999, y: 201 }
        const guides = [{ type: 'horizontal', y: 201 }]
        const result = applyGridFallback({ raw, snapped, guides, pixelsPerMesh: GRID })
        expect(result.x).toBe(Math.round(50 / GRID) * GRID)
        expect(result.y).toBe(201)
    })

    it('quantises raw y to the grid when no horizontal guide fired', () => {
        const raw = { x: 50, y: 200 }
        const snapped = { x: 49, y: 999 }
        const guides = [{ type: 'vertical', x: 49 }]
        const result = applyGridFallback({ raw, snapped, guides, pixelsPerMesh: GRID })
        expect(result.x).toBe(49)
        expect(result.y).toBe(Math.round(200 / GRID) * GRID)
    })

    it('falls back to pure grid on both axes when no guides fired', () => {
        const raw = { x: 50, y: 200 }
        const snapped = { x: 999, y: 999 }
        const guides = []
        const result = applyGridFallback({ raw, snapped, guides, pixelsPerMesh: GRID })
        expect(result).toEqual({
            x: Math.round(50 / GRID) * GRID,
            y: Math.round(200 / GRID) * GRID,
        })
    })

    it('matches the inlined behaviour exactly for a mix of snapped + grid axes', () => {
        const raw = { x: 12.3, y: 456.7 }
        const snapped = { x: 10, y: 455 }
        const guides = [{ type: 'vertical', x: 10 }]
        const hasX = guides.some(g => g.type === 'vertical')
        const hasY = guides.some(g => g.type === 'horizontal')
        const expected = {
            x: hasX ? snapped.x : Math.round(raw.x / GRID) * GRID,
            y: hasY ? snapped.y : Math.round(raw.y / GRID) * GRID,
        }
        expect(applyGridFallback({ raw, snapped, guides, pixelsPerMesh: GRID })).toEqual(expected)
    })
})
