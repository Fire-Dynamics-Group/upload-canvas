import { describe, it, expect } from 'vitest'
import {
    prepareElementsForFloor,
    quantizePointToGrid,
} from '../utils/generateFds'

// Open Plan Test Level 1: a "vertical" wall 0.086 px off true vertical.
// Live /fds 500s on that segment (zero-thickness OBST after metre conversion)
// and the 500 has no CORS, so the 3D tab shows "Failed to fetch".
const PPM = 8.478260869565219
const DEGENERATE_WALL = {
    id: 'd97fec84-10e1-4f05-a63f-e5fa8b27e448',
    type: 'polyline',
    comments: 'obstruction',
    points: [
        { x: 1136.0002886539407, y: 713.6666180350702 },
        { x: 1136.0869565217392, y: 271.304347826087 },
        { x: 568.0434782608696, y: 271.304347826087 },
        { x: 568.0434782608696, y: 712.1739130434784 },
        { x: 1136.0002886539407, y: 713.6666180350702 },
    ],
}
const MESH = {
    id: '9af4ca80-f523-4dfb-8c92-fac25d94dd7d',
    type: 'rect',
    comments: 'mesh',
    points: [
        { x: 568.0434782608696, y: 271.304347826087 },
        { x: 1136.0869565217392, y: 712.1739130434784 },
    ],
}

describe('quantize drawing onto the mesh grid before POST /fds', () => {
    it('maps the 0.086 px off-vertical X onto the same grid line', () => {
        const a = quantizePointToGrid(DEGENERATE_WALL.points[0], PPM)
        const b = quantizePointToGrid(DEGENERATE_WALL.points[1], PPM)
        expect(a.x).toBeCloseTo(b.x, 10)
        expect(a.x).toBeCloseTo(1136.0869565217392, 6)
    })

    it('prepareElementsForFloor collapses that wall onto true verticals/horizontals', () => {
        const prepared = prepareElementsForFloor([MESH, DEGENERATE_WALL], PPM, false)
        const wall = prepared.find((el) => el.comments === 'obstruction')
        expect(wall).toBeTruthy()
        expect(wall.points.length).toBeGreaterThanOrEqual(2)
        const [p0, p1] = wall.points
        expect(p0.x).toBeCloseTo(p1.x, 10)
        for (let i = 1; i < wall.points.length; i++) {
            const prev = wall.points[i - 1]
            const p = wall.points[i]
            const axisAligned = p.x === prev.x || p.y === prev.y
            expect(axisAligned).toBe(true)
            expect(p.x === prev.x && p.y === prev.y).toBe(false)
        }
    })
})
