import { describe, it, expect } from 'vitest'
import { computeCenterlinePoints } from '../utils/corridorCenterline'
import { findEnclosedRegions } from '../utils/findEnclosedRegions'

// Real North Finchley obstructions
const realElements = [
    { id: '423e73f9', comments: 'obstruction', points: [
        {x:667.3, y:1347.1}, {x:1208.6, y:1347.1}, {x:1208.6, y:1410.1},
        {x:835.1, y:1410.1}, {x:835.1, y:1569.5}, {x:747.0, y:1569.5},
        {x:747.0, y:1410.1}, {x:667.3, y:1410.1}, {x:667.3, y:1347.1}
    ]},
    { id: '0811f04c', comments: 'obstruction', points: [
        {x:940.0, y:1410.1}, {x:940.0, y:1342.9}
    ]},
    { id: '500ddcd8', comments: 'obstruction', points: [
        {x:940.0, y:1342.9}, {x:940.0, y:1196.0}, {x:881.3, y:1196.0},
        {x:881.3, y:1145.7}, {x:1053.3, y:1145.7}, {x:1053.3, y:1229.6},
        {x:998.8, y:1229.6}, {x:998.8, y:1347.1}
    ]},
    { id: 'c4069218', comments: 'obstruction', points: [
        {x:1053.3, y:1229.6}, {x:1095.3, y:1229.6}, {x:1095.3, y:1330.3},
        {x:1208.6, y:1330.3}, {x:1208.6, y:1011.4}, {x:1053.3, y:1011.4},
        {x:1053.3, y:1145.7}
    ]},
]

const pixelsPerMesh = 4.196
const pxPerM = pixelsPerMesh * 10

describe('Full sensor pipeline on real North Finchley data', () => {
    it('detects zones, assigns types, and produces sensors for ALL zones', () => {
        // Step 1: detect regions (same as zone tab)
        const regions = findEnclosedRegions(realElements)
        expect(regions.length).toBe(4)

        // Step 2: simulate user assigning zones (corridor + lobby)
        // Region 0 (region_3): right corridor
        // Region 2 (region_1): left corridor + lobby L-shape
        const zoneConfig = {}
        regions.forEach((r, i) => {
            if (i === 0) {
                zoneConfig[r.id] = { type: 'corridor', name: 'Corridor 1', sensors: true, points: r.points }
            } else if (i === 2) {
                zoneConfig[r.id] = { type: 'lobby', name: 'Lobby 1', sensors: true, points: r.points }
            }
            // Skip stair and apartment zones
        })

        // Step 3: replicate the button handler logic (the FIXED version)
        const sensorsEnabledZones = Object.values(zoneConfig).filter(
            z => z.sensors !== false && z.points && z.points.length >= 3
        )

        let allPoints = []
        for (const zone of sensorsEnabledZones) {
            const zoneSensors = computeCenterlinePoints(
                zone.points, [], {}, pixelsPerMesh
            )
            allPoints.push({ name: zone.name, type: zone.type, count: zoneSensors.length, sensors: zoneSensors })
        }

        console.log('\n=== SENSOR OUTPUT (simulating Compute Sensor Locations button) ===')
        let total = 0
        for (const z of allPoints) {
            console.log(`\n${z.name} (type=${z.type}): ${z.count} sensors`)
            z.sensors.slice(0, 5).forEach((s, i) => {
                console.log(`  ${i}: m(${(s.x/pxPerM).toFixed(2)}, ${(s.y/pxPerM).toFixed(2)})`)
            })
            if (z.count > 5) console.log(`  ... and ${z.count - 5} more`)
            total += z.count
        }
        console.log(`\nTotal: ${total} sensors across ${allPoints.length} zones`)

        // Assertions
        expect(allPoints.length).toBe(2) // corridor + lobby
        expect(allPoints[0].count).toBeGreaterThan(0)
        expect(allPoints[1].count).toBeGreaterThan(0)
        expect(allPoints.find(z => z.type === 'corridor')).toBeTruthy()
        expect(allPoints.find(z => z.type === 'lobby')).toBeTruthy()
    })
})
