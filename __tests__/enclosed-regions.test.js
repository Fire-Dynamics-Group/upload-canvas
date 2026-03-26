import { describe, it, expect } from 'vitest'
import { findEnclosedRegions } from '../utils/findEnclosedRegions'

// Helper: make an obstruction element from a list of [x,y] pairs
const makeObs = (id, coords) => ({
    id,
    type: 'polyline',
    points: coords.map(([x, y]) => ({ x, y })),
    comments: 'obstruction',
})

// Helper: make a door element
const makeDoor = (id, x1, y1, x2, y2) => ({
    id,
    type: 'polyline',
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    comments: 'door',
})

describe('findEnclosedRegions', () => {
    it('detects a single rectangular room from one closed polyline', () => {
        const elements = [
            makeObs(1, [[0, 0], [100, 0], [100, 80], [0, 80], [0, 0]]),
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(1)
        expect(regions[0].area).toBeGreaterThan(0)
    })

    it('detects two rooms from an L-shaped corridor with internal wall', () => {
        // Outer walls form a rectangle, internal wall splits it into 2 rooms
        //  ___________
        // |     |     |
        // |  A  |  B  |
        // |_____|_____|
        const elements = [
            // Outer rectangle
            makeObs(1, [[0, 0], [200, 0], [200, 100], [0, 100], [0, 0]]),
            // Internal wall splitting into A and B
            makeObs(2, [[100, 0], [100, 100]]),
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(2)
    })

    it('handles T-junctions: internal wall endpoint on middle of outer wall', () => {
        // A rectangle with an internal wall that T-junctions into the top wall
        //  ___________
        // |     |     |
        // |  A  |  B  |
        // |_____|_____|
        // But the internal wall goes from (100, 100) up to (100, 0)
        // hitting the top wall segment (0,0)-(200,0) at point (100,0)
        // This is a T-junction: (100,0) is NOT a vertex of the top wall
        const elements = [
            // Outer rectangle — top wall is one continuous segment from (0,0) to (200,0)
            makeObs(1, [[0, 0], [200, 0], [200, 100], [0, 100], [0, 0]]),
            // Internal wall from bottom to top — endpoint (100,0) hits middle of top wall
            makeObs(2, [[100, 100], [100, 0]]),
        ]
        const regions = findEnclosedRegions(elements)
        // Should detect 2 rooms, not 1 merged room
        expect(regions.length).toBe(2)
        // Each room should be roughly 100*100 = 10000 sq px
        for (const r of regions) {
            expect(r.area).toBeGreaterThan(4000)
            expect(r.area).toBeLessThan(15000)
        }
    })

    it('handles T-junctions on both ends of internal wall', () => {
        // Internal wall from (100,0) to (100,100) where both endpoints
        // land on the middle of the top and bottom outer wall segments
        const elements = [
            makeObs(1, [[0, 0], [200, 0]]),   // top wall
            makeObs(2, [[200, 0], [200, 100]]), // right wall
            makeObs(3, [[200, 100], [0, 100]]), // bottom wall
            makeObs(4, [[0, 100], [0, 0]]),     // left wall
            makeObs(5, [[100, 0], [100, 100]]), // internal wall — T-junctions at both ends
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(2)
    })

    it('detects 3 rooms with 2 internal walls', () => {
        //  ___________________
        // |     |      |      |
        // |  A  |  B   |  C   |
        // |_____|______|______|
        const elements = [
            makeObs(1, [[0, 0], [300, 0], [300, 100], [0, 100], [0, 0]]),
            makeObs(2, [[100, 0], [100, 100]]),
            makeObs(3, [[200, 0], [200, 100]]),
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(3)
    })

    it.skip('detects rooms when door fills a gap between walls', () => {
        // Two separate wall polylines with a gap between them.
        // A door bridges the gap, closing both rooms.
        //  ________        ________
        // |        |      |        |
        // |   A    | door |   B    |
        // |________|      |________|
        const elements = [
            // Left room: closed except right side has gap at y=30-70
            makeObs(1, [[0, 0], [100, 0], [100, 30]]),
            makeObs(11, [[100, 70], [100, 100], [0, 100], [0, 0]]),
            // Right room: closed except left side has gap at y=30-70
            makeObs(2, [[100, 30], [100, 0], [200, 0], [200, 100], [100, 100], [100, 70]]),
            // Door bridging the gap
            makeDoor(3, 100, 30, 100, 70),
        ]
        const regions = findEnclosedRegions(elements)
        // With the door closing the gap, should detect 2 rooms
        expect(regions.length).toBeGreaterThanOrEqual(2)
    })

    it('handles T-junction where inner wall endpoint is on a closed polyline segment', () => {
        // The outer shape is a single closed polyline. Inner wall T-junctions
        // onto TWO of its segments (top and bottom).
        const elements = [
            makeObs(1, [[0, 0], [200, 0], [200, 100], [0, 100], [0, 0]]),
            makeObs(2, [[80, 0], [80, 100]]),  // Both endpoints T-junction
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(2)
    })

    it('handles complex layout: corridor + fire room separated by internal wall', () => {
        // Simple version: rectangle split into 2 rooms by T-junction wall
        // The internal wall has one endpoint that T-junctions onto the outer wall
        //  _______________________
        // |  Fire  |   Corridor   |
        // |  Room  |              |
        // |________|______________|
        const elements = [
            // Outer rectangle
            makeObs(1, [[0, 0], [200, 0], [200, 100], [0, 100], [0, 0]]),
            // Internal wall: bottom endpoint (80,100) matches outer vertex,
            // top endpoint (80,0) T-junctions onto top wall
            makeObs(2, [[80, 100], [80, 0]]),
        ]
        const regions = findEnclosedRegions(elements)
        expect(regions.length).toBe(2)
        // Fire room: 80*100 = 8000, Corridor: 120*100 = 12000
        const areas = regions.map(r => r.area).sort((a, b) => a - b)
        expect(areas[0]).toBeGreaterThan(5000) // fire room
        expect(areas[1]).toBeGreaterThan(10000) // corridor
    })

    it('detects all rooms in real Ian Test 2 project data', () => {
        // Use coordinates with extra decimals to simulate real canvas precision
        const jitter = (v) => v + 0.025  // simulate sub-pixel precision differences
        const elements = [
            makeDoor(6, [[jitter(2206.7), jitter(1312.1)], [jitter(2168.3), jitter(1312.1)]]),
            makeDoor(7, [[jitter(2155.6), jitter(1295.0)], [jitter(2155.6), jitter(1256.7)]]),
            makeDoor(8, [[jitter(2304.7), jitter(1299.3)], [jitter(2304.7), jitter(1261.0)]]),
            makeDoor(9, [[jitter(2245.0), jitter(1120.4)], [jitter(2283.4), jitter(1120.4)]]),
            makeDoor(10, [[jitter(1997.9), jitter(1252.4)], [jitter(2036.3), jitter(1252.4)]]),
            makeDoor(11, [[jitter(1938.3), jitter(1252.4)], [jitter(1972.4), jitter(1252.4)]]),
            makeDoor(12, [[jitter(1912.7), jitter(1261.0)], [jitter(1912.7), jitter(1295.0)]]),
            makeDoor(13, [[jitter(1921.3), jitter(1307.8)], [jitter(1955.3), jitter(1307.8)]]),
            makeDoor(14, [[jitter(2095.9), jitter(1333.4)], [jitter(2130.0), jitter(1333.4)]]),
            makeObs(15, [[jitter(1819.0), jitter(1043.7)], [jitter(2040.5), jitter(1043.7)], [jitter(2040.5), jitter(1035.2)], [jitter(2108.7), jitter(1035.2)], [jitter(2108.7), jitter(1043.7)], [jitter(2142.8), jitter(1043.7)], [jitter(2142.8), jitter(1252.4)], [jitter(1912.7), jitter(1252.4)], [jitter(1912.7), jitter(1307.8)], [jitter(2083.1), jitter(1307.8)], [jitter(2083.1), jitter(1333.4)], [jitter(2142.8), jitter(1333.4)], [jitter(2142.8), jitter(1295.0)], [jitter(2155.6), jitter(1295.0)], [jitter(2155.6), jitter(1252.4)], [jitter(2142.8), jitter(1252.4)]]),
            makeDoor(17, [[jitter(2057.6), jitter(1035.2)], [jitter(2091.7), jitter(1035.2)]]),
            makeObs(18, [[jitter(2142.8), jitter(1333.4)], [jitter(2142.8), jitter(1469.7)], [jitter(1989.4), jitter(1469.7)], [jitter(1989.4), jitter(1307.8)], [jitter(1959.6), jitter(1307.8)], [jitter(1959.6), jitter(1376.0)], [jitter(1985.2), jitter(1376.0)], [jitter(1985.2), jitter(1448.4)], [jitter(1819.0), jitter(1448.4)], [jitter(1819.0), jitter(1307.8)], [jitter(1912.7), jitter(1307.8)]]),
            makeObs(19, [[jitter(1993.7), jitter(1252.4)], [jitter(1993.7), jitter(1188.5)], [jitter(1912.7), jitter(1188.5)], [jitter(1912.7), jitter(1209.8)], [jitter(1819.0), jitter(1209.8)], [jitter(1819.0), jitter(1307.8)]]),
            makeObs(20, [[jitter(1819.0), jitter(1209.8)], [jitter(1819.0), jitter(1043.7)]]),
            makeObs(21, [[jitter(2155.6), jitter(1252.4)], [jitter(2155.6), jitter(1180.0)], [jitter(2228.0), jitter(1180.0)], [jitter(2228.0), jitter(1120.4)], [jitter(2304.7), jitter(1120.4)], [jitter(2304.7), jitter(1303.6)], [jitter(2300.4), jitter(1303.6)], [jitter(2300.4), jitter(1316.3)], [jitter(2253.5), jitter(1316.3)], [jitter(2253.5), jitter(1312.1)], [jitter(2155.6), jitter(1312.1)], [jitter(2155.6), jitter(1295.0)]]),
        ]
        const regions = findEnclosedRegions(elements)
        console.log(`Real data: ${regions.length} regions detected`)
        for (const r of regions) {
            console.log(`  ${r.id}: area=${Math.round(r.area)}, pts=${r.points.length}`)
        }
        // 5 rooms detected - fire room + room 5 are one open region (no wall between them at top)
        // Would be 6 if a wall segment from (1993.7,1188.5) to obs[15] top existed
        expect(regions.length).toBe(5)
    })

    it('region IDs are stable based on centroid', () => {
        const elements = [
            makeObs(1, [[0, 0], [100, 0], [100, 80], [0, 80], [0, 0]]),
        ]
        const regions1 = findEnclosedRegions(elements)
        const regions2 = findEnclosedRegions(elements)
        expect(regions1[0].id).toBe(regions2[0].id)
        expect(regions1[0].id).toMatch(/^region_\d+_\d+$/)
    })
})
