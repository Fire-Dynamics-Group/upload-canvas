import { describe, it, expect } from 'vitest'
import { computeShaftRect } from '../utils/shaftGeometry'

describe('computeShaftRect', () => {
    it('horizontal opening: shaft extends perpendicular (away from corridor below)', () => {
        // Opening along top wall (horizontal), corridor centroid is below
        const opening = [{ x: 100, y: 50 }, { x: 200, y: 50 }]
        const corridorCentroid = { x: 150, y: 150 } // below the opening
        const rect = computeShaftRect(opening, 50, corridorCentroid)

        // Shaft should extend upward (negative Y in canvas) away from corridor
        expect(rect[0]).toEqual({ x: 100, y: 50 })
        expect(rect[1]).toEqual({ x: 200, y: 50 })
        expect(rect[2].y).toBeLessThan(50) // extends upward
        expect(rect[3].y).toBeLessThan(50)
        // Depth should be 50
        expect(Math.abs(rect[2].y - rect[1].y)).toBeCloseTo(50)
    })

    it('horizontal opening: shaft extends away from corridor above', () => {
        // Opening along bottom wall, corridor centroid is above
        const opening = [{ x: 100, y: 200 }, { x: 200, y: 200 }]
        const corridorCentroid = { x: 150, y: 100 } // above the opening
        const rect = computeShaftRect(opening, 50, corridorCentroid)

        // Shaft should extend downward (positive Y) away from corridor
        expect(rect[2].y).toBeGreaterThan(200)
        expect(rect[3].y).toBeGreaterThan(200)
    })

    it('vertical opening: shaft extends away from corridor to the left', () => {
        // Opening along right wall (vertical), corridor centroid is to the left
        const opening = [{ x: 300, y: 100 }, { x: 300, y: 200 }]
        const corridorCentroid = { x: 150, y: 150 } // left of opening
        const rect = computeShaftRect(opening, 40, corridorCentroid)

        // Shaft should extend rightward (positive X) away from corridor
        expect(rect[2].x).toBeGreaterThan(300)
        expect(rect[3].x).toBeGreaterThan(300)
        expect(Math.abs(rect[2].x - rect[1].x)).toBeCloseTo(40)
    })

    it('returns 4 corner points', () => {
        const opening = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
        const rect = computeShaftRect(opening, 30, { x: 50, y: 50 })
        expect(rect).toHaveLength(4)
    })

    it('returns null for zero-length opening', () => {
        const opening = [{ x: 50, y: 50 }, { x: 50, y: 50 }]
        const rect = computeShaftRect(opening, 30, null)
        expect(rect).toBeNull()
    })

    it('works without corridor centroid (defaults to one direction)', () => {
        const opening = [{ x: 100, y: 50 }, { x: 200, y: 50 }]
        const rect = computeShaftRect(opening, 50, null)
        expect(rect).toHaveLength(4)
        // Should still produce a valid rectangle with depth 50
        expect(Math.abs(rect[2].y - rect[1].y)).toBeCloseTo(50)
    })
})
