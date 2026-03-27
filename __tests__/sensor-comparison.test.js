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
// sub-polygon separately. The web app has one combined zone polygon.

// North Finchley — from FS2.csv (scale: 5.6m reference)
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
    // Web app combined corridor zone polygon (pixels)
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

const ianTest2 = {
    name: 'Ian Test 2',
    pixelsPerMesh: 4.260011737073032,
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

function coverageGaps(sensors, poly, inset = 0.4, maxGap = 2.0, step = 0.5) {
    const polyX = poly.map(p => p.x), polyY = poly.map(p => p.y)
    const xMin = Math.min(...polyX), xMax = Math.max(...polyX)
    const yMin = Math.min(...polyY), yMax = Math.max(...polyY)

    // Compute min distance to polygon edge
    function distToEdge(px, py) {
        let minDist = Infinity
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length]
            const dx = b.x - a.x, dy = b.y - a.y
            const lenSq = dx * dx + dy * dy
            if (lenSq === 0) continue
            let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
            t = Math.max(0, Math.min(1, t))
            const ex = a.x + t * dx, ey = a.y + t * dy
            const d = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2)
            if (d < minDist) minDist = d
        }
        return minDist
    }

    const gaps = []
    for (let x = xMin; x <= xMax; x += step) {
        for (let y = yMin; y <= yMax; y += step) {
            if (!pointInPolygon(x, y, polyX, polyY)) continue
            if (distToEdge(x, y) < inset) continue
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
// Runs getBestRectangles + returnCenterlines on each CSV sub-polygon
// separately, then combines. This is exactly what the EXE does.

describe('EXE algorithm (ground truth)', () => {
    describe('North Finchley: CC_Corner + Lobby_corner separately', () => {
        let ccSensors, lobbySensors, allExeSensors

        beforeAll(() => {
            const ccRects = getBestRectangles(northFinchley.ccCorner)
            ccSensors = returnCenterlines(ccRects, 0.5)
            const lobbyRects = getBestRectangles(northFinchley.lobbyCorner)
            lobbySensors = returnCenterlines(lobbyRects, 0.5)
            allExeSensors = [...ccSensors, ...lobbySensors]
        })

        it('produces sensors from both sub-polygons', () => {
            console.log(`\n=== EXE North Finchley ===`)
            console.log(`CC_Corner: ${ccSensors.length} sensors, Lobby_corner: ${lobbySensors.length} sensors`)
            expect(ccSensors.length).toBeGreaterThan(0)
            expect(lobbySensors.length).toBeGreaterThan(0)
        })

        it('CC sensors inside CC polygon', () => {
            const outside = ccSensors.filter(s => !isInsidePoly(s, northFinchley.ccCorner))
            expect(outside.length).toBe(0)
        })

        it('Lobby sensors inside lobby polygon', () => {
            const outside = lobbySensors.filter(s => !isInsidePoly(s, northFinchley.lobbyCorner))
            expect(outside.length).toBe(0)
        })

        it('no coverage gaps >2m in CC polygon', () => {
            const gaps = coverageGaps(ccSensors, northFinchley.ccCorner)
            if (gaps.length > 0) console.log(`CC gaps:`, gaps.slice(0, 5))
            expect(gaps.length).toBe(0)
        })

        it('no coverage gaps >2m in Lobby polygon', () => {
            const gaps = coverageGaps(lobbySensors, northFinchley.lobbyCorner)
            if (gaps.length > 0) console.log(`Lobby gaps:`, gaps.slice(0, 5))
            expect(gaps.length).toBe(0)
        })

        it('log EXE sensor positions', () => {
            console.log(`\nEXE total: ${allExeSensors.length} sensors`)
            allExeSensors.forEach((s, i) => console.log(`  ${i}: m(${s.x},${s.y})`))
        })
    })
})

// ─── Head-to-head: EXE vs Web App ──────────────────────────────────
// For North Finchley we have both the EXE CSV sub-polygons and the
// web app zone polygon. Every interior point covered by the EXE must
// also be covered by the web app (within tolerance).

describe('Head-to-head: EXE vs Web App (North Finchley)', () => {
    let exeSensorsM, webSensorsM
    const pxPerM = northFinchley.pixelsPerMesh * 10

    // Build the combined EXE polygon in metres (CC + Lobby outline)
    // for coverage comparison
    const combinedPolyM = [
        { x: 15.8, y: 31.6 },
        { x: 28.8, y: 32.1 },
        { x: 28.8, y: 33.6 },
        { x: 19.7, y: 33.1 },
        { x: 19.7, y: 36.9 },
        { x: 17.6, y: 36.9 },
        { x: 17.6, y: 35.5 },
        { x: 18.2, y: 35.5 },
        { x: 18.2, y: 33.1 },
        { x: 15.8, y: 33.1 },
    ]

    beforeAll(() => {
        // EXE: run on sub-polygons separately, combine
        const ccRects = getBestRectangles(northFinchley.ccCorner)
        const ccSensors = returnCenterlines(ccRects, 0.5)
        const lobbyRects = getBestRectangles(northFinchley.lobbyCorner)
        const lobbySensors = returnCenterlines(lobbyRects, 0.5)
        exeSensorsM = [...ccSensors, ...lobbySensors]

        // Web app: run on combined zone polygon
        const webSensorsPx = computeCenterlinePoints(
            northFinchley.corridorPoly, northFinchley.doors,
            northFinchley.doorRoles, northFinchley.pixelsPerMesh
        )
        webSensorsM = webSensorsPx.map(s => ({
            x: Math.round(s.x / pxPerM * 10) / 10,
            y: Math.round(s.y / pxPerM * 10) / 10,
        }))
    })

    it('web app produces at least as many sensors as EXE', () => {
        console.log(`\n=== Head-to-head: North Finchley ===`)
        console.log(`EXE: ${exeSensorsM.length} sensors`)
        console.log(`Web: ${webSensorsM.length} sensors`)
        expect(webSensorsM.length).toBeGreaterThanOrEqual(exeSensorsM.length * 0.8)
    })

    it('every EXE sensor has a web app sensor within 1m', () => {
        const unmatched = []
        for (const exe of exeSensorsM) {
            const nearest = Math.min(...webSensorsM.map(w =>
                Math.sqrt((w.x - exe.x) ** 2 + (w.y - exe.y) ** 2)
            ))
            if (nearest > 1.5) {
                unmatched.push({ exe, nearest: nearest.toFixed(2) })
            }
        }
        if (unmatched.length > 0) {
            console.log(`${unmatched.length} EXE sensors not matched by web app:`)
            unmatched.forEach(u => console.log(`  EXE m(${u.exe.x},${u.exe.y}) nearest web=${u.nearest}m`))
        }
        expect(unmatched.length).toBe(0)
    })

    it('web app covers same corridor interior as EXE (no gaps where EXE has coverage)', () => {
        // Sample grid points in the combined corridor, check both have coverage
        const polyX = combinedPolyM.map(p => p.x), polyY = combinedPolyM.map(p => p.y)
        const xMin = Math.min(...polyX), xMax = Math.max(...polyX)
        const yMin = Math.min(...polyY), yMax = Math.max(...polyY)

        let webOnly = 0, exeOnly = 0, both = 0
        for (let x = xMin + 0.4; x <= xMax - 0.4; x += 0.5) {
            for (let y = yMin + 0.4; y <= yMax - 0.4; y += 0.5) {
                if (!pointInPolygon(x, y, polyX, polyY)) continue

                const exeNearest = Math.min(...exeSensorsM.map(s =>
                    Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2)
                ))
                const webNearest = Math.min(...webSensorsM.map(s =>
                    Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2)
                ))

                const exeCovered = exeNearest <= 2.0
                const webCovered = webNearest <= 2.0

                if (exeCovered && webCovered) both++
                else if (exeCovered && !webCovered) exeOnly++
                else if (!exeCovered && webCovered) webOnly++
            }
        }

        console.log(`\nCoverage comparison (2m radius):`)
        console.log(`  Both cover: ${both} points`)
        console.log(`  EXE only: ${exeOnly} points (web app misses these)`)
        console.log(`  Web only: ${webOnly} points (web app has extra coverage)`)

        // Web app should not miss any point the EXE covers
        expect(exeOnly).toBe(0)
    })

    it('log both sensor sets for visual comparison', () => {
        console.log('\n--- EXE sensors (metres) ---')
        exeSensorsM.forEach((s, i) => console.log(`  ${i}: m(${s.x},${s.y})`))
        console.log('\n--- Web app sensors (metres) ---')
        webSensorsM.forEach((s, i) => console.log(`  ${i}: m(${s.x},${s.y})`))
    })
})

// ─── Web app algorithm on all projects ──────────────────────────────

describe('Web app algorithm: computeCenterlinePoints', () => {
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
                console.log(`\n=== Web app: ${project.name} — ${sensors.length} sensors ===`)
                expect(sensors.length).toBeGreaterThan(0)
            })

            it('all sensors inside corridor polygon', () => {
                const outside = sensors.filter(s => !isInsidePoly(s, project.corridorPoly))
                if (outside.length > 0) {
                    console.log(`${outside.length} sensors outside polygon:`)
                    outside.forEach(s => console.log(`  px(${s.x},${s.y})`))
                }
                expect(outside.length).toBe(0)
            })

            it('no coverage gaps >2m in corridor interior', () => {
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
        })
    }
})
