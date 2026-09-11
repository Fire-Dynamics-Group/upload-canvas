import { describe, it, expect } from 'vitest'
import { findEnclosedRegions } from '../utils/findEnclosedRegions'

/**
 * T-junction test: a wall endpoint lands in the middle of another wall's edge.
 * findEnclosedRegions must split the edge and create a node at the junction.
 *
 *  (0,0)─────────────────(100,0)
 *    |                       |
 *    |        (50,0)         |
 *    |          │            |
 *    |          │ divider    |
 *    |          │            |
 *    |        (50,50)        |
 *    |                       |
 *  (0,50)────────────────(100,50)
 *
 * The divider T-junctions onto the top and bottom edges (no explicit nodes at x=50).
 */

describe('zone detection with T-junction splitting', () => {
    it('splits a box into 2 regions when a divider T-junctions onto edges', () => {
        const elements = [
            // Outer box as a single polyline (no node at x=50 on top/bottom edges)
            { comments: 'obstruction', points: [
                { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 },
                { x: 0, y: 50 }, { x: 0, y: 0 }
            ]},
            // Dividing wall — endpoints land mid-edge on top and bottom
            { comments: 'obstruction', points: [
                { x: 50, y: 0 }, { x: 50, y: 50 }
            ]},
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions).toHaveLength(2)
        // Each region ~2500 px²
        for (const r of regions) {
            expect(r.area).toBeGreaterThan(2000)
            expect(r.area).toBeLessThan(3000)
        }
    })

    it('creates 3 regions with two T-junction dividers', () => {
        const elements = [
            { comments: 'obstruction', points: [
                { x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 60 },
                { x: 0, y: 60 }, { x: 0, y: 0 }
            ]},
            { comments: 'obstruction', points: [{ x: 30, y: 0 }, { x: 30, y: 60 }] },
            { comments: 'obstruction', points: [{ x: 60, y: 0 }, { x: 60, y: 60 }] },
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions).toHaveLength(3)
    })

    it('handles real-world layout: divider wall splitting an L-shaped corridor', () => {
        // Simplified North Finchley layout: L-shaped corridor with a dividing wall
        const elements = [
            // L-shaped corridor
            { comments: 'obstruction', points: [
                { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 },
                { x: 40, y: 30 }, { x: 40, y: 80 }, { x: 20, y: 80 },
                { x: 20, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 0 }
            ]},
            // Dividing wall at x=50 — T-junctions onto top and bottom edges
            { comments: 'obstruction', points: [
                { x: 50, y: 30 }, { x: 50, y: 0 }
            ]},
        ]
        const regions = findEnclosedRegions(elements)
        // Should produce 2 regions: left corridor+lobby, right corridor
        expect(regions).toHaveLength(2)
    })
})
