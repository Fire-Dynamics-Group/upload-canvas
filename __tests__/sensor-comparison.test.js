import { describe, it, expect, beforeAll } from 'vitest'
import {
    computeCenterlinePoints,
    getBestRectangles,
    returnCenterlines,
    pointInPolygon,
} from '../utils/corridorCenterline'

// ─── Test data from real projects ───────────────────────────────────
// EXE receives vertices in metres from CSV, split by area (CC_Corner,
// Lobby_corner). It runs getBestRectangles + returnCenterlines on each
// sub-polygon separately. The web app has one combined obstruction.

// North Finchley — from FS2.csv (scale: 5.6m reference)
// CC_Corner: 4 vertices (simple rectangle)
// Lobby_corner: 10 vertices (L-shaped extension)
const northFinchley = {
    name: 'North Finchley',
    pixelsPerMesh: 4.196580544360626,
    // EXE sub-polygons (metres, from CSV)
    ccCorner: [
        { x: 15.9, y: 32.1 },
        { x: 28.8, y: 32.1 },
        { x: 28.8, y: 33.6 },
        { x: 15.9, y: 33.6 },
    ],
    lobbyCorner: [
        { x: 17.6, y: 36.9 },
        { x: 17.6, y: 35.5 },
        { x: 18.2, y: 35.5 },
        { x: 18.2, y: 33.1 },
        { x: 15.8, y: 33.1 },
        { x: 15.8, y: 31.6 },
        { x: 22.1, y: 31.7 },
        { x: 22.1, y: 33.1 },
        { x: 19.7, y: 33.1 },
        { x: 19.7, y: 36.9 },
    ],
    // Web app combined corridor obstruction (pixels)
    corridorPoly: [
        { x: 667.2563065533395, y: 1347.1023547397608 },
        { x: 1208.6151967758603, y: 1347.1023547397608 },
        { x: 1208.6151967758603, y: 1410.0510629051703 },
        { x: 835.1195283277646, y: 1410.0510629051703 },
        { x: 835.1195283277646, y: 1569.5211235908741 },
        { x: 746.9913368961915, y: 1569.5211235908741 },
        { x: 746.9913368961915, y: 1410.0510629051703 },
        { x: 667.2563065533395, y: 1410.0510629051703 },
    ],
    doors: [
        { id: 6, points: [{ x: 780.56, y: 1569.52 }, { x: 826.73, y: 1569.52 }], comments: 'door' },
        { id: 14, points: [{ x: 1208.62, y: 1393.26 }, { x: 1208.62, y: 1355.50 }], comments: 'door' },
        { id: 25, points: [{ x: 667.26, y: 1401.66 }, { x: 667.26, y: 1363.89 }], comments: 'door' },
    ],
    doorRoles: { 6: 'stair', 14: 'apartment', 25: 'lobby' },
}

// Ian Test 2 — CC_Corner equivalent (the main rectangular section)
// and the rest of the corridor shape
const ianTest2 = {
    name: 'Ian Test 2',
    pixelsPerMesh: 4.260011737073032,
    // For Ian Test 2 we use the full corridor as a single polygon since
    // we don't have the CSV split. The web app polygon has 16 vertices.
    corridorPoly: [
        { x: 1819.0250117301848, y: 1043.7028755828928 },
        { x: 2040.5456220579824, y: 1043.7028755828928 },
        { x: 2040.5456220579824, y: 1035.1828521087468 },
        { x: 2108.705809851151, y: 1035.1828521087468 },
        { x: 2108.705809851151, y: 1043.7028755828928 },
        { x: 2142.785903747735, y: 1043.7028755828928 },
        { x: 2142.785903747735, y: 1252.4434506994714 },
        { x: 1912.7452699457915, y: 1252.4434506994714 },
        { x: 1912.7452699457915, y: 1307.823603281421 },
        { x: 2083.1457394287127, y: 1307.823603281421 },
        { x: 2083.1457394287127, y: 1333.3836737038591 },
        { x: 2142.785903747735, y: 1333.3836737038591 },
        { x: 2142.785903747735, y: 1295.043568070202 },
        { x: 2155.5659389589546, y: 1295.043568070202 },
        { x: 2155.5659389589546, y: 1252.4434506994714 },
        { x: 2142.785903747735, y: 1252.4434506994714 },
    ],
    doors: [
        { id: 6, points: [{ x: 2206.69, y: 1312.08 }, { x: 2168.35, y: 1312.08 }], comments: 'door' },
        { id: 7, points: [{ x: 2155.57, y: 1295.04 }, { x: 2155.57, y: 1256.70 }], comments: 'door' },
    ],
    doorRoles: { 6: 'stair', 7: 'apartment' },
}

// ─── Helpers ────────────────────────────────────────────────────────

function isInsidePoly(point, poly) {
    return pointInPolygon(point.x, point.y, poly.map(p => p.x), poly.map(p => p.y))
}

function distToEdge(point, poly) {
    let minDist = Infinity
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const dx = b.x - a.x, dy = b.y - a.y
        const lenSq = dx * dx + dy * dy
        if (lenSq === 0) continue
        let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq
        t = Math.max(0, Math.min(1, t))
        const px = a.x + t * dx, py = a.y + t * dy
        const d = Math.sqrt((point.x - px) ** 2 + (point.y - py) ** 2)
        if (d < minDist) minDist = d
    }
    return minDist
}

function coverageGaps(sensors, poly, inset = 0.4, maxGap = 2.0, step = 0.5) {
    const polyX = poly.map(p => p.x), polyY = poly.map(p => p.y)
    const xMin = Math.min(...polyX), xMax = Math.max(...polyX)
    const yMin = Math.min(...polyY), yMax = Math.max(...polyY)
    const gaps = []
    for (let x = xMin; x <= xMax; x += step) {
        for (let y = yMin; y <= yMax; y += step) {
            if (!pointInPolygon(x, y, polyX, polyY)) continue
            if (distToEdge({ x, y }, poly) < inset) continue
            const nearest = Math.min(...sensors.map(s =>
                Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2)
            ))
            if (nearest > maxGap) {
                gaps.push({ x: x.toFixed(2), y: y.toFixed(2), dist: nearest.toFixed(2) })
            }
        }
    }
    return gaps
}

// ─── EXE algorithm (ground truth) ───────────────────────────────────
// The EXE runs getBestRectangles + returnCenterlines on each sub-polygon
// separately (CC_Corner, Lobby_corner), then combines the sensors.

describe('EXE algorithm (ground truth)', () => {
    describe('North Finchley: CC_Corner + Lobby_corner separately', () => {
        let ccSensors, lobbySensors, allSensors

        beforeAll(() => {
            const ccRects = getBestRectangles(northFinchley.ccCorner)
            ccSensors = returnCenterlines(ccRects, 0.5)

            const lobbyRects = getBestRectangles(northFinchley.lobbyCorner)
            lobbySensors = returnCenterlines(lobbyRects, 0.5)

            allSensors = [...ccSensors, ...lobbySensors]
        })

        it('produces sensors from both sub-polygons', () => {
            console.log(`\n=== EXE North Finchley ===`)
            console.log(`CC_Corner: ${ccSensors.length} sensors`)
            console.log(`Lobby_corner: ${lobbySensors.length} sensors`)
            console.log(`Total: ${allSensors.length} sensors`)
            expect(ccSensors.length).toBeGreaterThan(0)
            expect(lobbySensors.length).toBeGreaterThan(0)
        })

        it('CC sensors inside CC polygon', () => {
            const outside = ccSensors.filter(s => !isInsidePoly(s, northFinchley.ccCorner))
            if (outside.length > 0) {
                console.log('CC sensors outside polygon:')
                outside.forEach(s => console.log(`  m(${s.x},${s.y})`))
            }
            expect(outside.length).toBe(0)
        })

        it('Lobby sensors inside lobby polygon', () => {
            const outside = lobbySensors.filter(s => !isInsidePoly(s, northFinchley.lobbyCorner))
            if (outside.length > 0) {
                console.log('Lobby sensors outside polygon:')
                outside.forEach(s => console.log(`  m(${s.x},${s.y})`))
            }
            expect(outside.length).toBe(0)
        })

        it('CC sensors at least 0.3m from walls', () => {
            const tooClose = ccSensors.filter(s => distToEdge(s, northFinchley.ccCorner) < 0.3)
            if (tooClose.length > 0) {
                console.log('CC sensors too close:')
                tooClose.forEach(s => console.log(`  m(${s.x},${s.y}) dist=${distToEdge(s, northFinchley.ccCorner).toFixed(3)}m`))
            }
            expect(tooClose.length).toBe(0)
        })

        it('Lobby sensors at least 0.3m from walls', () => {
            const tooClose = lobbySensors.filter(s => distToEdge(s, northFinchley.lobbyCorner) < 0.3 - 0.01)
            if (tooClose.length > 0) {
                console.log('Lobby sensors too close:')
                tooClose.forEach(s => console.log(`  m(${s.x},${s.y}) dist=${distToEdge(s, northFinchley.lobbyCorner).toFixed(3)}m`))
            }
            expect(tooClose.length).toBe(0)
        })

        it('no coverage gaps >2m in CC polygon interior', () => {
            const gaps = coverageGaps(ccSensors, northFinchley.ccCorner)
            if (gaps.length > 0) {
                console.log(`CC gaps: ${gaps.length}`)
                gaps.slice(0, 5).forEach(g => console.log(`  m(${g.x},${g.y}) nearest=${g.dist}m`))
            }
            expect(gaps.length).toBe(0)
        })

        it('no coverage gaps >2m in Lobby polygon interior', () => {
            const gaps = coverageGaps(lobbySensors, northFinchley.lobbyCorner)
            if (gaps.length > 0) {
                console.log(`Lobby gaps: ${gaps.length}`)
                gaps.slice(0, 5).forEach(g => console.log(`  m(${g.x},${g.y}) nearest=${g.dist}m`))
            }
            expect(gaps.length).toBe(0)
        })

        it('log sensor positions', () => {
            console.log('\n--- CC sensors ---')
            ccSensors.forEach((s, i) => console.log(`  ${i}: m(${s.x},${s.y})`))
            console.log('\n--- Lobby sensors ---')
            lobbySensors.forEach((s, i) => console.log(`  ${i}: m(${s.x},${s.y})`))
        })
    })
})

// ─── Current algorithm (computeCenterlinePoints) ────────────────────
// Must produce correct sensors on the combined web app polygon.

describe('Current algorithm (computeCenterlinePoints)', () => {
    for (const project of [northFinchley, ianTest2]) {
        describe(`Project: ${project.name}`, () => {
            let sensors
            const pxPerM = project.pixelsPerMesh * 10

            beforeAll(() => {
                sensors = computeCenterlinePoints(
                    project.corridorPoly, project.doors, project.doorRoles,
                    project.pixelsPerMesh, 0.5, 0.4
                )
            })

            it('produces sensors', () => {
                console.log(`\n=== Current: ${project.name} — ${sensors.length} sensors ===`)
                expect(sensors.length).toBeGreaterThan(0)
            })

            it('all sensors inside corridor polygon', () => {
                const outside = sensors.filter(s => !isInsidePoly(s, project.corridorPoly))
                if (outside.length > 0) {
                    console.log(`${outside.length} sensors outside polygon:`)
                    outside.forEach(s => {
                        const m = { x: (s.x / pxPerM).toFixed(2), y: (s.y / pxPerM).toFixed(2) }
                        console.log(`  px(${s.x},${s.y}) m(${m.x},${m.y})`)
                    })
                }
                expect(outside.length).toBe(0)
            })

            it('all sensors at least 0.3m from walls', () => {
                const minInsetPx = 0.3 * pxPerM
                const tooClose = sensors.filter(s =>
                    isInsidePoly(s, project.corridorPoly) &&
                    distToEdge(s, project.corridorPoly) < minInsetPx
                )
                if (tooClose.length > 0) {
                    console.log(`${tooClose.length} sensors too close to wall:`)
                    tooClose.forEach(s => {
                        const d = distToEdge(s, project.corridorPoly) / pxPerM
                        console.log(`  px(${s.x},${s.y}) dist=${d.toFixed(3)}m`)
                    })
                }
                expect(tooClose.length).toBe(0)
            })

            it('no coverage gaps >2m in corridor interior', () => {
                const polyX = project.corridorPoly.map(p => p.x)
                const polyY = project.corridorPoly.map(p => p.y)
                const insetPx = 0.4 * pxPerM
                const gaps = coverageGaps(sensors, project.corridorPoly, insetPx, 2.0 * pxPerM, 0.5 * pxPerM)
                if (gaps.length > 0) {
                    console.log(`${gaps.length} coverage gaps:`)
                    gaps.slice(0, 10).forEach(g => {
                        console.log(`  m(${(parseFloat(g.x) / pxPerM).toFixed(2)},${(parseFloat(g.y) / pxPerM).toFixed(2)}) nearest=${(parseFloat(g.dist) / pxPerM).toFixed(2)}m`)
                    })
                }
                expect(gaps.length).toBe(0)
            })

            it('log sensor positions', () => {
                sensors.forEach((s, i) => {
                    const m = { x: (s.x / pxPerM).toFixed(2), y: (s.y / pxPerM).toFixed(2) }
                    console.log(`  ${i}: px(${s.x},${s.y}) m(${m.x},${m.y})`)
                })
            })
        })
    }
})
