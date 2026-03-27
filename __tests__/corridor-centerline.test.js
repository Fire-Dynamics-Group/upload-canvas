import { describe, it, expect } from 'vitest'
import {
    findPerpendicularBounds,
    getCorridorAxis,
    getCorridorRange,
    computeCenterlinePoints,
    findCorridorObstruction,
    getBestRectangles,
    returnCenterlines,
    pointInPolygon,
    computeStairSensorPositions,
} from '../utils/corridorCenterline'

// Helper: simple rectangle polygon (clockwise)
const makeRect = (x1, y1, x2, y2) => [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
    { x: x1, y: y1 }, // close polygon
]

// Helper: make a door element
const makeDoor = (id, x1, y1, x2, y2) => ({
    id,
    type: 'polyline',
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    comments: 'door',
})

describe('findPerpendicularBounds', () => {
    const rect = makeRect(0, 0, 100, 20) // wide rectangle

    it('finds Y bounds for horizontal corridor (ray at x=50)', () => {
        const bounds = findPerpendicularBounds(rect, 50, true)
        expect(bounds).not.toBeNull()
        expect(bounds[0]).toBeCloseTo(0) // top edge
        expect(bounds[1]).toBeCloseTo(20) // bottom edge
    })

    it('finds Y bounds at polygon edge (x=0)', () => {
        const bounds = findPerpendicularBounds(rect, 0, true)
        expect(bounds).not.toBeNull()
    })

    it('returns null outside polygon (x=150)', () => {
        const bounds = findPerpendicularBounds(rect, 150, true)
        expect(bounds).toBeNull()
    })

    it('finds X bounds for vertical corridor (ray at y=10)', () => {
        const tallRect = makeRect(0, 0, 20, 100) // tall rectangle
        const bounds = findPerpendicularBounds(tallRect, 50, false)
        expect(bounds).not.toBeNull()
        expect(bounds[0]).toBeCloseTo(0)
        expect(bounds[1]).toBeCloseTo(20)
    })

    it('handles L-shaped polygon', () => {
        // L-shape: wide bottom, narrow top-right
        const lShape = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 10 },
            { x: 50, y: 10 },
            { x: 50, y: 30 },
            { x: 0, y: 30 },
            { x: 0, y: 0 },
        ]
        // Ray at x=25 should span full height (0 to 30)
        const bounds1 = findPerpendicularBounds(lShape, 25, true)
        expect(bounds1).not.toBeNull()
        expect(bounds1[0]).toBeCloseTo(0)
        expect(bounds1[1]).toBeCloseTo(30)

        // Ray at x=75 should span narrow part (0 to 10)
        const bounds2 = findPerpendicularBounds(lShape, 75, true)
        expect(bounds2).not.toBeNull()
        expect(bounds2[0]).toBeCloseTo(0)
        expect(bounds2[1]).toBeCloseTo(10)
    })
})

describe('getCorridorAxis', () => {
    it('returns horizontal when doors spread more in X', () => {
        const doors = [
            makeDoor(1, 10, 50, 10, 60),  // left side
            makeDoor(2, 90, 50, 90, 60),  // right side
        ]
        const roles = { 1: 'apartment', 2: 'stair' }
        expect(getCorridorAxis(doors, roles)).toBe('horizontal')
    })

    it('returns vertical when doors spread more in Y', () => {
        const doors = [
            makeDoor(1, 50, 10, 60, 10),  // top
            makeDoor(2, 50, 90, 60, 90),  // bottom
        ]
        const roles = { 1: 'apartment', 2: 'stair' }
        expect(getCorridorAxis(doors, roles)).toBe('vertical')
    })

    it('ignores leakage doors', () => {
        const doors = [
            makeDoor(1, 50, 10, 60, 10),
            makeDoor(2, 50, 90, 60, 90),
            makeDoor(3, 200, 200, 210, 200), // leakage - far away
        ]
        const roles = { 1: 'apartment', 2: 'stair', 3: 'leakage' }
        expect(getCorridorAxis(doors, roles)).toBe('vertical')
    })

    it('returns null with fewer than 2 corridor doors', () => {
        const doors = [makeDoor(1, 10, 50, 10, 60)]
        const roles = { 1: 'apartment' }
        expect(getCorridorAxis(doors, roles)).toBeNull()
    })
})

describe('getCorridorRange', () => {
    it('returns min/max X positions for horizontal corridor', () => {
        const doors = [
            makeDoor(1, 20, 50, 20, 60),   // center x=20
            makeDoor(2, 80, 50, 80, 60),   // center x=80
        ]
        const roles = { 1: 'stair', 2: 'apartment' }
        const range = getCorridorRange(doors, roles, true)
        expect(range.min).toBe(20)
        expect(range.max).toBe(80)
    })

    it('returns min/max Y positions for vertical corridor', () => {
        const doors = [
            makeDoor(1, 50, 20, 60, 20),   // center y=20
            makeDoor(2, 50, 80, 60, 80),   // center y=80
        ]
        const roles = { 1: 'stair', 2: 'apartment' }
        const range = getCorridorRange(doors, roles, false)
        expect(range.min).toBe(20)
        expect(range.max).toBe(80)
    })
})

describe('computeCenterlinePoints', () => {
    // pixelsPerMesh=10 means pxPerM=100 (10*10)
    const pxPerMesh = 10

    it('places sensors along centerline of horizontal corridor', () => {
        // 10m wide, 2m tall corridor in pixels (1000px x 200px)
        const poly = makeRect(0, 0, 1000, 200)
        const doors = [
            makeDoor(1, 100, 0, 100, 200),
            makeDoor(2, 900, 0, 900, 200),
        ]
        const roles = { 1: 'stair', 2: 'apartment' }

        const points = computeCenterlinePoints(poly, doors, roles, pxPerMesh, 0.5, 0.4)

        expect(points.length).toBeGreaterThan(0)
        // Sensors should be near the Y-midpoint (100px) of the corridor
        const nearCenterline = points.filter(p => Math.abs(p.y - 100) < 10)
        expect(nearCenterline.length).toBeGreaterThan(0)
    })

    it('places sensors along centerline of vertical corridor', () => {
        // 2m wide, 10m tall corridor
        const poly = makeRect(0, 0, 200, 1000)
        const doors = [
            makeDoor(1, 0, 100, 200, 100),
            makeDoor(2, 0, 900, 200, 900),
        ]
        const roles = { 1: 'stair', 2: 'apartment' }

        const points = computeCenterlinePoints(poly, doors, roles, pxPerMesh, 0.5, 0.4)

        expect(points.length).toBeGreaterThan(0)
        // Sensors should be near the X-midpoint (100px) of the corridor
        const nearCenterline = points.filter(p => Math.abs(p.x - 100) < 10)
        expect(nearCenterline.length).toBeGreaterThan(0)
    })

    it('sensors cover full polygon even when doors are close together', () => {
        const poly = makeRect(0, 0, 1000, 200)
        const doors = [
            makeDoor(1, 500, 0, 500, 200),
            makeDoor(2, 510, 0, 510, 200),
        ]
        const roles = { 1: 'stair', 2: 'apartment' }

        const points = computeCenterlinePoints(poly, doors, roles, pxPerMesh)
        // Should still cover full polygon regardless of door proximity
        expect(points.length).toBeGreaterThan(10)
    })

    it('follows polygon centerline for non-rectangular corridor', () => {
        // Corridor that is wider on left (y: 0-200) and narrower on right (y: 50-150)
        const poly = [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 1000, y: 50 },
            { x: 1000, y: 150 },
            { x: 500, y: 200 },
            { x: 0, y: 200 },
            { x: 0, y: 0 },
        ]
        const doors = [
            makeDoor(1, 100, 0, 100, 200),
            makeDoor(2, 900, 50, 900, 150),
        ]
        const roles = { 1: 'stair', 2: 'apartment' }

        const points = computeCenterlinePoints(poly, doors, roles, pxPerMesh, 1.0, 0.4)

        expect(points.length).toBeGreaterThan(0)
        // Left side should be near y=100 (mid of 0-200)
        // Right side should be near y=100 (mid of 50-150) — same center but narrower
        // All should track the actual midline
        points.forEach(p => {
            expect(p.y).toBeGreaterThan(0)
            expect(p.y).toBeLessThan(200)
        })
    })

    it('produces sensors even when no doors have corridor roles', () => {
        const poly = makeRect(0, 0, 1000, 200) // horizontal
        const doors = [makeDoor(1, 100, 0, 100, 200)]
        const roles = { 1: 'leakage' } // no corridor doors

        const points = computeCenterlinePoints(poly, doors, roles, pxPerMesh, 0.5, 0.4)

        expect(points.length).toBeGreaterThan(0)
        // First sensor should be near the left edge with inset
        expect(points[0].x).toBeLessThan(100)
    })
})

// Helper: make an obstruction element
const makeObstruction = (id, points) => ({
    id,
    type: 'polyline',
    points,
    comments: 'obstruction',
})

// Real polygon data used by multiple test suites
const realPoly = [
    {"x": 1819.03, "y": 1043.70}, {"x": 2040.55, "y": 1043.70},
    {"x": 2040.55, "y": 1035.18}, {"x": 2108.71, "y": 1035.18},
    {"x": 2108.71, "y": 1043.70}, {"x": 2142.79, "y": 1043.70},
    {"x": 2142.79, "y": 1252.44}, {"x": 1912.75, "y": 1252.44},
    {"x": 1912.75, "y": 1307.82}, {"x": 2083.15, "y": 1307.82},
    {"x": 2083.15, "y": 1333.38}, {"x": 2142.79, "y": 1333.38},
    {"x": 2142.79, "y": 1295.04}, {"x": 2155.57, "y": 1295.04},
    {"x": 2155.57, "y": 1252.44}, {"x": 2142.79, "y": 1252.44},
]
const realDoors = [
    makeDoor(6, 2206.69, 1312.08, 2168.35, 1312.08),
    makeDoor(7, 2155.57, 1295.04, 2155.57, 1256.70),
]
const realRoles = { 6: 'stair', 7: 'apartment' }
const realPxPerMesh = 4.260011737073032

describe('getBestRectangles', () => {
    it('decomposes a simple rectangle into 1m segments along the long axis', () => {
        // 5m x 2m rectangle in metres
        const points = [
            { x: 0, y: 0 }, { x: 5, y: 0 },
            { x: 5, y: 2 }, { x: 0, y: 2 },
        ]
        const rects = getBestRectangles(points)
        // Should produce 5 segments of 1m each: [0,1,0,2, 1,2,0,2, ...]
        expect(rects.length).toBe(5 * 4) // 5 rects, 4 values each
        // First rect
        expect(rects[0]).toBe(0)  // xmin
        expect(rects[1]).toBe(1)  // xmax
        expect(rects[2]).toBe(0)  // ymin
        expect(rects[3]).toBe(2)  // ymax
        // Last rect
        expect(rects[16]).toBe(4) // xmin
        expect(rects[17]).toBe(5) // xmax
    })

    it('decomposes a tall rectangle into 1m segments along Y', () => {
        const points = [
            { x: 0, y: 0 }, { x: 2, y: 0 },
            { x: 2, y: 4 }, { x: 0, y: 4 },
        ]
        const rects = getBestRectangles(points)
        expect(rects.length).toBe(4 * 4) // 4 rects
        // First rect along Y
        expect(rects[0]).toBe(0)  // xmin
        expect(rects[1]).toBe(2)  // xmax
        expect(rects[2]).toBe(0)  // ymin
        expect(rects[3]).toBe(1)  // ymax
    })

    it('decomposes an L-shaped polygon into rectangles that cover the area', () => {
        // L-shape: 6 vertices
        // Bottom: 0,0 -> 4,0 -> 4,2 -> 2,2 -> 2,4 -> 0,4 -> 0,0
        const points = [
            { x: 0, y: 0 }, { x: 4, y: 0 },
            { x: 4, y: 2 }, { x: 2, y: 2 },
            { x: 2, y: 4 }, { x: 0, y: 4 },
        ]
        const rects = getBestRectangles(points)
        // Should produce at least 2 rectangles covering the L-shape
        expect(rects.length).toBeGreaterThanOrEqual(8) // at least 2 rects
        // Total area of rects should equal polygon area (4*2 + 2*2 = 12)
        let totalArea = 0
        for (let i = 0; i < rects.length; i += 4) {
            totalArea += (rects[i+1] - rects[i]) * (rects[i+3] - rects[i+2])
        }
        expect(totalArea).toBeCloseTo(12, 0)
    })
})

describe('returnCenterlines', () => {
    it('places points along the long axis of a horizontal rectangle', () => {
        // 5m x 2m rect: xmin=0, xmax=5, ymin=0, ymax=2
        const rects = [0, 5, 0, 2]
        const points = returnCenterlines(rects, 0.5)
        // After 0.4m inset: x range 0.4-4.6, y midline = 1.0
        // 4.2m / 0.5 = 8.4, so round(8.4)+1 = 9 points
        expect(points.length).toBe(9)
        // All points at y midline
        points.forEach(p => {
            expect(p.y).toBeCloseTo(1.0, 1)
        })
        // First point at x=0.4
        expect(points[0].x).toBeCloseTo(0.4, 1)
        // Spacing between points
        expect(points[1].x - points[0].x).toBeCloseTo(0.5, 1)
    })

    it('places points along the long axis of a vertical rectangle', () => {
        // 2m x 5m rect
        const rects = [0, 2, 0, 5]
        const points = returnCenterlines(rects, 0.5)
        // After inset: y range 0.4-4.6, x midline = 1.0
        expect(points.length).toBe(9)
        points.forEach(p => {
            expect(p.x).toBeCloseTo(1.0, 1)
        })
        expect(points[0].y).toBeCloseTo(0.4, 1)
    })

    it('handles multiple rectangles', () => {
        const rects = [0, 3, 0, 2, 3, 6, 0, 2]
        const points = returnCenterlines(rects, 0.5)
        // Two rects, each producing points
        expect(points.length).toBeGreaterThan(5)
    })
})

describe('computeCenterlinePoints with rectangle decomposition', () => {
    it('real data: rects and centerlines match visually', () => {
        const pxPerM = realPxPerMesh * 10
        const metrePoints = realPoly.map(p => ({ x: p.x / pxPerM, y: p.y / pxPerM }))
        const rects = getBestRectangles(metrePoints)
        console.log('Rects:', rects.length / 4)
        for (let i = 0; i < rects.length; i += 4) {
            const xmin = rects[i], xmax = rects[i+1], ymin = rects[i+2], ymax = rects[i+3]
            console.log(`Rect ${i/4}: x=[${xmin.toFixed(2)},${xmax.toFixed(2)}] y=[${ymin.toFixed(2)},${ymax.toFixed(2)}] dx=${(xmax-xmin).toFixed(2)} dy=${(ymax-ymin).toFixed(2)}`)
        }
        const centers = returnCenterlines(rects, 0.5)
        console.log('Centerline points:', centers.length)
        centers.forEach((p, i) => {
            console.log(`  sensor ${i}: metre(${p.x},${p.y}) pixel(${Math.round(p.x*pxPerM)},${Math.round(p.y*pxPerM)})`)
        })

        // Each sensor should be INSIDE a rectangle (at midpoint of short axis)
        for (const pt of centers) {
            let insideAny = false
            for (let i = 0; i < rects.length; i += 4) {
                // Use raw rect (before 0.4 inset) for bounds check
                if (pt.x >= rects[i] - 0.1 && pt.x <= rects[i+1] + 0.1 &&
                    pt.y >= rects[i+2] - 0.1 && pt.y <= rects[i+3] + 0.1) {
                    insideAny = true
                    break
                }
            }
            expect(insideAny).toBe(true)
        }
        expect(centers.length).toBeGreaterThan(0)
    })

    it('real project data: sensors along full corridor polygon', () => {
        const points = computeCenterlinePoints(realPoly, realDoors, realRoles, realPxPerMesh)

        expect(points.length).toBeGreaterThan(10)
        // All sensors should be within the polygon Y bounds
        points.forEach(p => {
            expect(p.y).toBeGreaterThanOrEqual(1035)
            expect(p.y).toBeLessThanOrEqual(1340)
        })
        // Sensors should span most of the X range
        const sensorXs = points.map(p => p.x)
        expect(Math.min(...sensorXs)).toBeLessThan(1920)
        expect(Math.max(...sensorXs)).toBeGreaterThan(2100)
    })
})

describe('findCorridorObstruction', () => {
    it('picks the obstruction closest to both corridor doors', () => {
        // Corridor polygon: long rectangle from x=50 to x=950
        const corridorObs = makeObstruction(1, makeRect(50, 40, 950, 80))
        // Apartment polygon: rectangle off to the side
        const aptObs = makeObstruction(2, makeRect(0, 200, 200, 400))
        // Stair polygon: rectangle elsewhere
        const stairObs = makeObstruction(3, makeRect(800, 200, 1000, 400))

        // Doors sit on the corridor obstruction edges
        const doors = [
            makeDoor(10, 100, 40, 100, 80),   // stair door on corridor wall
            makeDoor(11, 900, 40, 900, 80),   // apt door on corridor wall
        ]
        const roles = { 10: 'stair', 11: 'apartment' }

        const result = findCorridorObstruction(
            [corridorObs, aptObs, stairObs], doors, roles
        )
        expect(result.id).toBe(1) // should pick the corridor
    })

    it('ignores leakage doors when finding corridor', () => {
        const corridorObs = makeObstruction(1, makeRect(50, 40, 950, 80))
        const aptObs = makeObstruction(2, makeRect(0, 200, 200, 400))

        const doors = [
            makeDoor(10, 100, 40, 100, 80),       // stair door on corridor
            makeDoor(11, 900, 40, 900, 80),       // apt door on corridor
            makeDoor(12, 100, 200, 100, 400),     // leakage door on apartment
        ]
        const roles = { 10: 'stair', 11: 'apartment', 12: 'leakage' }

        const result = findCorridorObstruction(
            [corridorObs, aptObs], doors, roles
        )
        expect(result.id).toBe(1)
    })

    it('falls back to largest obstruction when no corridor doors', () => {
        const small = makeObstruction(1, makeRect(0, 0, 10, 10))
        const large = makeObstruction(2, makeRect(0, 0, 100, 100))

        const doors = [makeDoor(10, 5, 5, 5, 10)]
        const roles = { 10: 'leakage' }

        const result = findCorridorObstruction([small, large], doors, roles)
        expect(result.id).toBe(2) // largest
    })
})

describe('computeStairSensorPositions', () => {
    // pixelsPerMesh=10 means pxPerM=100
    const pxPerMesh = 10

    it('places two sensor positions behind a horizontal stair door into the stair', () => {
        // Stair polygon: large rectangle below the door
        // Door is horizontal at y=100, stair extends downward (y=100 to y=500)
        const stairPoly = [
            { x: 0, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 500 },
            { x: 0, y: 500 },
            { x: 0, y: 100 },
        ]
        // Horizontal door at y=100, spanning x=50 to x=150
        const stairDoor = makeDoor(1, 50, 100, 150, 100)
        // Landing inside stair, below the door (center y=200)
        const landing = { id: 2, type: 'rect', points: [{ x: 20, y: 150 }, { x: 180, y: 250 }], comments: 'landing' }

        const positions = computeStairSensorPositions(stairDoor, stairPoly, landing, pxPerMesh)

        expect(positions).toHaveLength(2)
        // Door midpoint x = 100, door at y=100
        // Landing center y=200 > door y=100, so offset is in +y direction
        // 0.8m offset = 80px, 1.8m offset = 180px
        expect(positions[0].x).toBeCloseTo(100, 0)
        expect(positions[0].y).toBeCloseTo(180, 0) // 100 + 80
        expect(positions[1].x).toBeCloseTo(100, 0)
        expect(positions[1].y).toBeCloseTo(280, 0) // 100 + 180
    })

    it('places sensors behind a vertical stair door into the stair', () => {
        // Stair polygon: rectangle to the right of the door
        const stairPoly = [
            { x: 100, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 200 },
            { x: 100, y: 200 },
            { x: 100, y: 0 },
        ]
        // Vertical door at x=100, spanning y=50 to y=150
        const stairDoor = makeDoor(1, 100, 50, 100, 150)
        // Landing inside stair, to the right of door (center x=250)
        const landing = { id: 2, type: 'rect', points: [{ x: 150, y: 20 }, { x: 350, y: 180 }], comments: 'landing' }

        const positions = computeStairSensorPositions(stairDoor, stairPoly, landing, pxPerMesh)

        expect(positions).toHaveLength(2)
        // Door midpoint y = 100, door at x=100
        // Landing center x=250 > door x=100, so offset is in +x direction
        expect(positions[0].x).toBeCloseTo(180, 0) // 100 + 80
        expect(positions[0].y).toBeCloseTo(100, 0)
        expect(positions[1].x).toBeCloseTo(280, 0) // 100 + 180
        expect(positions[1].y).toBeCloseTo(100, 0)
    })

    it('filters out positions that fall outside the stair polygon', () => {
        // Small stair polygon: only extends 1m (100px) below door
        // So 0.8m offset fits, but 1.8m offset does NOT fit inside
        const stairPoly = [
            { x: 0, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 }, // only 100px = 1m deep
            { x: 0, y: 200 },
            { x: 0, y: 100 },
        ]
        const stairDoor = makeDoor(1, 50, 100, 150, 100)
        const landing = { id: 2, type: 'rect', points: [{ x: 20, y: 110 }, { x: 180, y: 190 }], comments: 'landing' }

        const positions = computeStairSensorPositions(stairDoor, stairPoly, landing, pxPerMesh)

        // 0.8m (80px) fits inside (y=180 < 200), 1.8m (180px) does not (y=280 > 200)
        // Opposite direction: y=100-180=-80 also outside, so only 1 position
        expect(positions).toHaveLength(1)
        expect(positions[0].y).toBeCloseTo(180, 0)
    })

    it('uses real project data from Ian Test 2', () => {
        // Stair door (id=6): horizontal at y=1312
        const stairDoor = makeDoor(6, 2206.69, 1312.08, 2168.35, 1312.08)

        // Stair obstruction (id=5) from mockData
        const stairPoly = [
            { x: 2155.57, y: 1252.44 },
            { x: 2155.57, y: 1295.04 },
            { x: 2142.79, y: 1295.04 },
            { x: 2142.79, y: 1333.38 },
            { x: 2083.15, y: 1333.38 },
            { x: 2083.15, y: 1307.82 },
            { x: 2206.69, y: 1307.82 },
            { x: 2206.69, y: 1380.00 },
            { x: 2310.00, y: 1380.00 },
            { x: 2310.00, y: 1200.00 },
            { x: 2206.69, y: 1200.00 },
            { x: 2206.69, y: 1252.44 },
            { x: 2155.57, y: 1252.44 },
        ]

        // Landing element (floor landing inside stair, below the door)
        const landing = {
            id: 3,
            type: 'rect',
            points: [{ x: 2210, y: 1320 }, { x: 2300, y: 1370 }],
            comments: 'landing',
        }

        const positions = computeStairSensorPositions(stairDoor, stairPoly, landing, realPxPerMesh)

        // Should produce at least 1 position inside the stair
        expect(positions.length).toBeGreaterThanOrEqual(1)
        // Each position should be inside the stair polygon
        const polyX = stairPoly.map(p => p.x)
        const polyY = stairPoly.map(p => p.y)
        for (const pos of positions) {
            expect(pointInPolygon(pos.x, pos.y, polyX, polyY)).toBe(true)
        }
    })
})
