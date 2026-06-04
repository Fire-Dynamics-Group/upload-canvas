import { describe, it, expect } from 'vitest'
import {
    viewFactorRect,
    totalViewFactor,
    incidentRadiation,
    solveSForTarget,
    requiredBoundaryDistance,
    emissivePower,
    celsiusToKelvin,
    solveElevation,
    assessElevation,
    pointToPolylineDistance,
    pointAtDistanceAlong,
    buildBoundaryArrows,
    boundaryDistanceOutward,
    gridlineStations,
    lineOfSightClear,
    totalViewFactorPartial,
    columnPositions,
    assessElevationBays,
    suggestProtection,
    outwardNormalAt,
    buildRequiredBoundaryLine,
    rectVFAt,
    totalViewFactorPieces,
    buildEmitter,
    baysCoveredBySpan,
    projectSpanOntoWall,
} from '../utils/efsViewFactor'

// Ground truth from EFS.xlsx (South sheet): elevation 96 m wide x 18 m high,
// T = 1040 C + 273 = 1313 K, target 12.6 kW/m^2, bottom_h = top_h = height/2 = 9.
const T = celsiusToKelvin(1040) // 1313

describe('EFS view-factor primitive (validated against EFS.xlsx)', () => {
    it('computes emissive power ~168.5 kW/m^2 at 1313 K', () => {
        expect(emissivePower(T)).toBeCloseTo(168.5, 0)
    })

    it('matches the goal-sought S for the edge gridline (0 / 96 split)', () => {
        const S = solveSForTarget(0, 96, 9, 9, T, 12.6)
        expect(S).toBeCloseTo(55.888, 2)
        expect(totalViewFactor(0, 96, S, 9, 9)).toBeCloseTo(0.074770, 5)
        expect(incidentRadiation(0, 96, S, 9, 9, T)).toBeCloseTo(12.6, 4)
    })

    it('matches the goal-sought S for the centre gridline (48 / 48 split)', () => {
        const S = solveSForTarget(48, 48, 9, 9, T, 12.6)
        expect(S).toBeCloseTo(76.682, 2)
        expect(incidentRadiation(48, 48, S, 9, 9, T)).toBeCloseTo(12.6, 4)
    })

    it('required boundary distance is half the separation (col V = U/2)', () => {
        expect(requiredBoundaryDistance(55.888)).toBeCloseTo(27.944, 3)
    })

    it('returns zero view factor for a degenerate rectangle / distance', () => {
        expect(viewFactorRect(0, 9, 50)).toBe(0)
        expect(viewFactorRect(96, 0, 50)).toBe(0)
        expect(viewFactorRect(96, 9, 0)).toBe(0)
    })

    it('goal-seek converges across a wide range without throwing', () => {
        const sSmall = solveSForTarget(0.5, 0.5, 0.5, 0.5, T, 12.6)
        const sBig = solveSForTarget(200, 200, 50, 50, T, 12.6)
        expect(Number.isFinite(sSmall)).toBe(true)
        expect(Number.isFinite(sBig)).toBe(true)
        expect(sBig).toBeGreaterThan(sSmall)
    })
})

describe('solveElevation — gridline sweep (vs EFS.xlsx South, 96m / 8m spacing)', () => {
    const result = solveElevation({ width: 96, height: 18, T, spacing: 8 })

    it('lays gridlines from 0 to the far edge at the given spacing', () => {
        expect(result.rows[0].leftW).toBe(0)
        expect(result.rows[result.rows.length - 1].leftW).toBe(96)
        expect(result.rows).toHaveLength(13) // 0,8,...,88,96
    })

    it('the governing (worst) required boundary distance is the centre gridline', () => {
        // centre split 48/48 -> S 76.682 -> required 38.341 (EFS.xlsx V22)
        expect(result.governingRequiredBoundaryDistance).toBeCloseTo(38.341, 2)
    })
})

describe('geometry helpers (closest distance to boundary)', () => {
    it('measures the shortest distance from a point to a polyline', () => {
        const poly = [{ x: 0, y: -40 }, { x: 96, y: -40 }]
        expect(pointToPolylineDistance({ x: 48, y: 0 }, poly)).toBeCloseTo(40, 6)
        expect(pointToPolylineDistance({ x: 0, y: 0 }, poly)).toBeCloseTo(40, 6)
    })

    it('finds a point at an arc-length along the wall', () => {
        const wall = [{ x: 0, y: 0 }, { x: 96, y: 0 }]
        expect(pointAtDistanceAlong(wall, 48)).toEqual({ x: 48, y: 0 })
        expect(pointAtDistanceAlong(wall, 200)).toEqual({ x: 96, y: 0 }) // clamped
    })
})

describe('assessElevation — actual boundary distance + pass/fail', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]

    it('passes everywhere when the boundary is beyond the governing distance', () => {
        const boundaryPoints = [{ x: 0, y: -40 }, { x: 96, y: -40 }]
        const r = assessElevation({ wallPoints, boundaryPoints, height: 18, T, spacing: 8 })
        expect(r.governingRequiredBoundaryDistance).toBeCloseTo(38.341, 2)
        expect(r.rows.every((row) => row.actualBoundaryDistance >= 39.999)).toBe(true)
        expect(r.allPass).toBe(true)
        expect(r.failingCount).toBe(0)
    })

    it('flags failing gridlines when the boundary is too close', () => {
        const boundaryPoints = [{ x: 0, y: -30 }, { x: 96, y: -30 }]
        const r = assessElevation({ wallPoints, boundaryPoints, height: 18, T, spacing: 8 })
        expect(r.allPass).toBe(false)
        expect(r.failingCount).toBeGreaterThan(0)
        const centre = r.rows.find((row) => row.leftW === 48)
        expect(centre.pass).toBe(false)   // required 38.34 > 30
        expect(r.rows[0].pass).toBe(true) // edge required 27.94 < 30
    })

    it('exposes the spreadsheet per-gridline columns (Bottom_h, Top_h, View Factor, Is, S)', () => {
        // wall 96 m wide, 18 m high, 8 m spacing -> centre gridline is the 48/48 split
        const r = assessElevation({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        const centre = r.rows.find((row) => row.leftW === 48)
        expect(centre.bottomH).toBeCloseTo(9, 6)        // height/2 (EFS.xlsx E22)
        expect(centre.topH).toBeCloseTo(9, 6)           // height/2 (EFS.xlsx F22)
        expect(centre.viewFactorTotal).toBeCloseTo(0.074770, 5) // EFS.xlsx S22
        expect(centre.incident).toBeCloseTo(12.6, 3)    // EFS.xlsx T22 (goal-seek target)
        expect(centre.S).toBeCloseTo(76.682, 2)         // EFS.xlsx U22
        expect(centre.requiredBoundaryDistance).toBeCloseTo(38.341, 2) // EFS.xlsx V22
    })

    it('returns null actual distance / pass when no boundary is supplied', () => {
        const r = assessElevation({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        expect(r.hasBoundary).toBe(false)
        expect(r.rows[0].actualBoundaryDistance).toBe(null)
        expect(r.allPass).toBe(null)
    })
})

describe('buildBoundaryArrows — per-segment worst-case arrows', () => {
    it('returns one arrow per segment (bay between columns)', () => {
        const wall = [{ x: 0, y: 0 }, { x: 96, y: 0 }]
        const boundary = [{ x: 0, y: -40 }, { x: 96, y: -40 }]
        const arrows = buildBoundaryArrows(wall, boundary, 8, 0.1)
        expect(arrows).toHaveLength(12) // 13 columns -> 12 segments
        expect(arrows[0].distance).toBeCloseTo(40, 6)
        expect(arrows[0].to.y).toBeCloseTo(-40, 6)
    })

    it('takes the worst case (smallest distance) within a segment, even mid-bay', () => {
        const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
        // boundary dips closest to the wall at the segment midpoint (x = 20)
        const boundary = [{ x: 0, y: -30 }, { x: 20, y: -10 }, { x: 40, y: -30 }]
        const arrows = buildBoundaryArrows(wall, boundary, 40, 0.1) // single segment 0..40
        expect(arrows).toHaveLength(1)
        expect(arrows[0].distance).toBeCloseTo(10, 1) // not 30 (the column ends)
        expect(arrows[0].from.x).toBeCloseTo(20, 1)
    })

    it('returns [] when there is no boundary or spacing', () => {
        expect(buildBoundaryArrows([{ x: 0, y: 0 }, { x: 10, y: 0 }], [], 8, 0.1)).toEqual([])
        expect(buildBoundaryArrows([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: -5 }, { x: 10, y: -5 }], 0, 0.1)).toEqual([])
    })
})

describe('boundaryDistanceOutward — perpendicular to the elevation', () => {
    const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]

    it('is the perpendicular distance for a parallel boundary', () => {
        const boundary = [{ x: -10, y: -20 }, { x: 50, y: -20 }] // parallel, below
        const r = boundaryDistanceOutward(wall, 20, boundary) // gridline at (20,0)
        expect(r.outward).toBe(true)
        expect(r.distance).toBeCloseTo(20, 6)
        expect(r.point.x).toBeCloseTo(20, 6)
        expect(r.point.y).toBeCloseTo(-20, 6)
    })

    it('measures straight out (not the shorter diagonal) for an angled boundary', () => {
        // boundary slants; at x=20 it sits at y=-20, so the perpendicular hit is
        // (20,-20) even though a diagonal to a nearer part of the line is shorter.
        const boundary = [{ x: 0, y: -10 }, { x: 40, y: -30 }]
        const r = boundaryDistanceOutward(wall, 20, boundary) // from (20,0)
        expect(r.outward).toBe(true)
        expect(r.point.x).toBeCloseTo(20, 6)
        expect(r.point.y).toBeCloseTo(-20, 6)
        expect(r.distance).toBeCloseTo(20, 6)
    })

    it('falls back (outward:false) when no perpendicular meets the boundary', () => {
        // boundary is off to the side of the right end — the perpendicular at
        // (40,0) runs straight down x=40 and never meets the x=0 line.
        const boundary = [{ x: 0, y: -10 }, { x: 0, y: -50 }]
        const r = boundaryDistanceOutward(wall, 40, boundary)
        expect(r.outward).toBe(false)
    })
})

describe('lineOfSightClear — must not pass through the building polyline', () => {
    // building outline: a closed rectangle
    const building = [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 },
    ]

    it('is false when the line cuts through the building', () => {
        // from the left edge straight across to the right -> crosses the rectangle
        expect(lineOfSightClear({ x: 0, y: 5 }, { x: 20, y: 5 }, building)).toBe(false)
    })

    it('is true for an outward line that does not cross the building', () => {
        expect(lineOfSightClear({ x: 0, y: 5 }, { x: -20, y: 5 }, building)).toBe(true)
    })
})

describe('boundaryDistanceOutward — real building rectangle never measures through it', () => {
    // Closed-rectangle building footprint (efsWall) inside a wrapping site
    // boundary (efsBoundary) — the exact geometry from the canvas.
    const wall = [
        { x: 1364.4443631016986, y: 754.754277894468 },
        { x: 1364.4443631016986, y: 1946.8035134548118 },
        { x: 3888.3510778992163, y: 1946.8035134548118 },
        { x: 3888.3510778992163, y: 754.754277894468 },
        { x: 1364.4443631016986, y: 754.754277894468 },
    ]
    const boundary = [
        { x: 1236.199207247764, y: 980.7600853419759 },
        { x: 1200.4587539769952, y: 823.0816150297611 },
        { x: 1200.4587539769952, y: 669.607903925872 },
        { x: 2039.308216037978, y: 488.8032579678658 },
        { x: 2643.7423522348013, y: 404.70807380135125 },
        { x: 4010.2890949406624, y: 638.0722098634292 },
        { x: 4042.875978805187, y: 1655.623938278255 },
        { x: 4099.640228117584, y: 2042.4617854442222 },
        { x: 4150.097338617493, y: 2230.6247600167985 },
        { x: 3888.3510778992163, y: 2325.231842204127 },
        { x: 3611.8881599518, y: 2389.3544201310947 },
        { x: 3163.0301144630284, y: 2438.760340828922 },
        { x: 1685.0572527365352, y: 2438.760340828922 },
        { x: 1585.1942215387992, y: 2427.197253006026 },
        { x: 1324.4991506226042, y: 2467.1424654851207 },
        { x: 1292.9634565601611, y: 2603.7971397557067 },
        { x: 1329.7550996330112, y: 2613.2578479744398 },
        { x: 1349.7277058725585, y: 2670.022097286837 },
        { x: 966.0434281128358, y: 2886.567196515612 },
        { x: 923.9958360295786, y: 2815.0862899740746 },
        { x: 814.6720966131097, y: 2859.2362616614946 },
        { x: 662.2495753113021, y: 2342.05087903743 },
        { x: 931.3541646441487, y: 2263.2116438813227 },
        { x: 797.8530597798068, y: 1362.3419834975357 },
        { x: 797.8530597798068, y: 1221.482550018624 },
        { x: 1236.199207247764, y: 980.7600853419759 },
    ]

    it('every per-segment arrow is line-of-sight clear (no crossing the building)', () => {
        const arrows = buildBoundaryArrows(wall, boundary, 200, 20)
        expect(arrows.length).toBeGreaterThan(0)
        for (const a of arrows) {
            expect(a.distance).toBeGreaterThan(0)
            expect(a.outward).toBe(true)
            expect(lineOfSightClear(a.from, a.to, wall)).toBe(true)
        }
    })
})

describe('totalViewFactorPartial — holed emitter (protected bays)', () => {
    it('reproduces totalViewFactor exactly for a single all-unprotected bay', () => {
        // single bay spanning the whole 96 m elevation, receiver at various xR
        for (const xR of [0, 8, 24, 48, 72, 96]) {
            const S = 60
            const partial = totalViewFactorPartial(xR, [[0, 96]], S, 9, 9)
            const full = totalViewFactor(xR, 96 - xR, S, 9, 9)
            expect(partial).toBeCloseTo(full, 9)
        }
    })

    it('a hole (protected bay) lowers the view factor vs the full face', () => {
        // emitter [0,96] vs emitter with the centre [40,56] removed
        const S = 60
        const full = totalViewFactorPartial(0, [[0, 96]], S, 9, 9)
        const holed = totalViewFactorPartial(0, [[0, 40], [56, 96]], S, 9, 9)
        expect(holed).toBeLessThan(full)
        expect(holed).toBeGreaterThan(0)
    })

    it('summing adjacent bays equals the merged interval (strips telescope)', () => {
        const S = 50
        const split = totalViewFactorPartial(20, [[0, 40], [40, 96]], S, 9, 9)
        const merged = totalViewFactorPartial(20, [[0, 96]], S, 9, 9)
        expect(split).toBeCloseTo(merged, 9)
    })
})

describe('columnPositions — bay layout', () => {
    it('lays columns at 0, spacing, ..., width (far edge included)', () => {
        expect(columnPositions(96, 8)).toEqual([0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96])
        expect(columnPositions(40, 8)).toHaveLength(6) // 5 bays
    })
})

describe('assessElevationBays — per-bay assessment', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]

    it('reports one row per bay (columns - 1)', () => {
        const r = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        expect(r.nBays).toBe(12)
        expect(r.rows).toHaveLength(12)
        expect(r.rows.every((row) => row.protected === false)).toBe(true)
    })

    it('governing required matches the gridline sweep when nothing is protected', () => {
        const r = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        // worst point of the centre bays approaches the 48/48 split governing value
        expect(r.governingRequiredBoundaryDistance).toBeCloseTo(38.341, 1)
    })

    it('protecting bays removes them from the emitter and lowers required everywhere', () => {
        const all = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        const someProtected = assessElevationBays({
            wallPoints, boundaryPoints: [], height: 18, T, spacing: 8, protectedBays: [1, 12],
        })
        expect(someProtected.governingRequiredBoundaryDistance)
            .toBeLessThan(all.governingRequiredBoundaryDistance)
        // protected bays are compliant by construction
        expect(someProtected.rows.find((r) => r.bay === 1).protected).toBe(true)
        expect(someProtected.rows.find((r) => r.bay === 1).pass).toBe(true)
    })

    it('flags failing bays when the boundary is too close', () => {
        const boundaryPoints = [{ x: 0, y: -30 }, { x: 96, y: -30 }]
        const r = assessElevationBays({ wallPoints, boundaryPoints, height: 18, T, spacing: 8 })
        expect(r.allPass).toBe(false)
        expect(r.failingCount).toBeGreaterThan(0)
        // a centre bay (required ~38 > 30) must fail
        const centre = r.rows.find((row) => row.bay === 6)
        expect(centre.pass).toBe(false)
    })

    it('finds a mid-bay worst point at a boundary notch (critical-point, not endpoints)', () => {
        const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
        // boundary dips closest to the wall at the bay midpoint (x = 20)
        const boundary = [{ x: 0, y: -60 }, { x: 20, y: -8 }, { x: 40, y: -60 }]
        const r = assessElevationBays({ wallPoints: wall, boundaryPoints: boundary, height: 18, T, spacing: 40 })
        expect(r.rows).toHaveLength(1)
        // the worst (smallest actual) sits mid-bay, not at the columns
        expect(r.rows[0].actualBoundaryDistance).toBeCloseTo(8, 0)
        expect(r.rows[0].xWorst).toBeCloseTo(20, 0)
    })
})

describe('suggestProtection — auto-protect loop', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]

    it('returns not-achievable / no-boundary when no boundary is drawn', () => {
        const r = suggestProtection({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        expect(r.achievable).toBe(false)
        expect(r.reason).toBe('no-boundary')
    })

    it('protects bays until the elevation is compliant', () => {
        // parallel boundary at 30 m: centre bays fail (required ~38), so some
        // protection is needed; protecting bays lowers required until all pass
        const boundaryPoints = [{ x: 0, y: -30 }, { x: 96, y: -30 }]
        const r = suggestProtection({ wallPoints, boundaryPoints, height: 18, T, spacing: 8 })
        expect(r.achievable).toBe(true)
        expect(r.protectedBays.length).toBeGreaterThan(0)
        expect(r.protectedBays.length).toBeLessThan(12) // shouldn't need to protect everything
        // re-assessing with the suggested set must pass
        const check = assessElevationBays({
            wallPoints, boundaryPoints, height: 18, T, spacing: 8, protectedBays: r.protectedBays,
        })
        expect(check.allPass).toBe(true)
    })

    it('corners-first protects an end bay first; off picks the worst-shortfall bay', () => {
        // boundary notched closest near the centre, so the worst-shortfall bay is
        // interior; corners-first overrides that to take an end bay first.
        const boundary = [{ x: 0, y: -34 }, { x: 48, y: -22 }, { x: 96, y: -34 }]
        const on = suggestProtection({
            wallPoints, boundaryPoints: boundary, height: 18, T, spacing: 8, cornersFirst: true,
        })
        const off = suggestProtection({
            wallPoints, boundaryPoints: boundary, height: 18, T, spacing: 8, cornersFirst: false,
        })
        expect([1, 12]).toContain(on.steps[0])         // an end bay first
        expect(off.steps[0]).toBeGreaterThan(1)        // an interior bay first
        expect(off.steps[0]).toBeLessThan(12)
        expect(on.achievable).toBe(true)
        expect(off.achievable).toBe(true)
    })
})

describe('outwardNormalAt — perpendicular unit normal toward the boundary', () => {
    const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]

    it('points toward a parallel boundary below the wall', () => {
        const boundary = [{ x: -10, y: -20 }, { x: 50, y: -20 }]
        const n = outwardNormalAt(wall, 20, boundary)
        expect(n.x).toBeCloseTo(0, 6)
        expect(n.y).toBeCloseTo(-1, 6) // straight down, toward the boundary
    })

    it('is a unit vector', () => {
        const boundary = [{ x: 0, y: -10 }, { x: 40, y: -30 }]
        const n = outwardNormalAt(wall, 20, boundary)
        expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6)
    })

    it('falls back to the nearest boundary direction when no perpendicular meets it', () => {
        // boundary off to the side of the right end (the perpendicular misses it)
        const boundary = [{ x: 0, y: -10 }, { x: 0, y: -50 }]
        const n = outwardNormalAt(wall, 40, boundary)
        expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6)
    })
})

describe('buildRequiredBoundaryLine — needed-boundary locus (required distance offset)', () => {
    const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
    const boundary = [{ x: -10, y: -100 }, { x: 50, y: -100 }] // parallel, well below

    it('offsets each station outward by its required distance', () => {
        // 5 stations at 0,10,20,30,40; required = 10 m everywhere
        const required = [10, 10, 10, 10, 10]
        const line = buildRequiredBoundaryLine(wall, boundary, 10, required)
        expect(line).toHaveLength(5)
        for (const p of line) {
            expect(p.point.y).toBeCloseTo(-10, 6) // 10 below the wall (toward boundary)
        }
        expect(line[2].point.x).toBeCloseTo(20, 6)
    })

    it('reflects a varying required distance (the locus bulges where required is larger)', () => {
        const required = [5, 10, 20, 10, 5]
        const line = buildRequiredBoundaryLine(wall, boundary, 10, required)
        expect(line[0].point.y).toBeCloseTo(-5, 6)
        expect(line[2].point.y).toBeCloseTo(-20, 6) // bulges out at the centre
        expect(line[4].point.y).toBeCloseTo(-5, 6)
    })

    it('returns [] without a boundary to define the outward side', () => {
        expect(buildRequiredBoundaryLine(wall, [], 10, [10, 10])).toEqual([])
    })
})

describe('assessElevationBays.requiredByStation — needed-boundary input', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]

    it('gives a required distance per column station that the locus can offset by', () => {
        const r = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        expect(r.requiredByStation).toHaveLength(r.nBays + 1) // one per column station
        // centre station (48 m) governs at ~38.341 m, same as the gridline sweep
        const centreIdx = 6 // station at 48 m (0,8,...,48 -> index 6)
        expect(r.requiredByStation[centreIdx]).toBeCloseTo(38.341, 1)
        expect(r.requiredByStation.every((d) => d >= 0)).toBe(true)
    })

    it('shrinks when bays are protected (smaller emitter -> nearer needed boundary)', () => {
        const open = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        const prot = assessElevationBays({
            wallPoints, boundaryPoints: [], height: 18, T, spacing: 8, protectedBays: [1, 2, 11, 12],
        })
        const maxOpen = Math.max(...open.requiredByStation)
        const maxProt = Math.max(...prot.requiredByStation)
        expect(maxProt).toBeLessThan(maxOpen)
    })
})

describe('rectVFAt — 2-D telescoping view factor with a vertical band', () => {
    it('reproduces the full-height corner-rectangle sum (band 0..H, m = H/2)', () => {
        const H = 18, m = H / 2, S = 60
        // single full bay [0,96], receiver at xR -> matches totalViewFactor
        for (const xR of [0, 24, 48, 96]) {
            const banded = rectVFAt(xR, 0, 96, 0, H, m, S)
            const full = totalViewFactor(xR, 96 - xR, S, m, m)
            expect(banded).toBeCloseTo(full, 9)
        }
    })

    it('a part-height band radiates less than the full height', () => {
        const H = 18, m = H / 2, S = 60
        const full = rectVFAt(20, 0, 96, 0, H, m, S)
        const band = rectVFAt(20, 0, 96, 6, 12, m, S) // central 6..12 m only
        expect(band).toBeLessThan(full)
        expect(band).toBeGreaterThan(0)
    })

    it('a band split into two stacked sub-bands equals the whole band', () => {
        const m = 9, S = 50
        const whole = rectVFAt(20, 0, 96, 0, 18, m, S)
        const lower = rectVFAt(20, 0, 96, 0, 9, m, S)
        const upper = rectVFAt(20, 0, 96, 9, 18, m, S)
        expect(lower + upper).toBeCloseTo(whole, 9)
    })
})

describe('baysCoveredBySpan / projectSpanOntoWall — snapping regions to bays', () => {
    it('includes every bay the span touches (snap, extend into the next bay)', () => {
        // width 96, spacing 8 -> bays 1..12 at [0,8],[8,16],...
        expect(baysCoveredBySpan(96, 8, 0, 8)).toEqual([1])
        expect(baysCoveredBySpan(96, 8, 4, 20)).toEqual([1, 2, 3]) // crosses into bay 3
        expect(baysCoveredBySpan(96, 8, 17, 17.5)).toEqual([3])
    })

    it('projects a drawn region polyline onto the wall arc-length span', () => {
        const wall = [{ x: 0, y: 0 }, { x: 96, y: 0 }]
        const region = [{ x: 10, y: 3 }, { x: 30, y: -2 }] // roughly over x 10..30
        const { start, end } = projectSpanOntoWall(wall, region)
        expect(start).toBeCloseTo(10, 5)
        expect(end).toBeCloseTo(30, 5)
    })
})

describe('buildEmitter — protected/unprotected regions (#11)', () => {
    const base = { width: 96, spacing: 8, height: 18 }

    it('a full-height protected region removes the whole bay', () => {
        const r = buildEmitter({ ...base, regions: [{ kind: 'protected', bays: [6], base: 0, top: 18 }] })
        const bay6 = r.bayStatus.find((s) => s.bay === 6)
        expect(bay6.status).toBe('protected')
        expect(bay6.emitting).toHaveLength(0)
        expect(r.pieces.some((p) => p.a === 40 && p.b === 48)).toBe(false) // bay6 not emitting
    })

    it('a part-height protected band leaves the complement emitting', () => {
        const r = buildEmitter({ ...base, regions: [{ kind: 'protected', bays: [6], base: 6, top: 12 }] })
        const bay6 = r.bayStatus.find((s) => s.bay === 6)
        expect(bay6.status).toBe('partially-protected')
        // complement = [0,6] and [12,18]
        expect(bay6.emitting).toEqual([{ base: 0, top: 6 }, { base: 12, top: 18 }])
    })

    it('an unprotected band locks the bay but leaves the emitter unchanged', () => {
        const r = buildEmitter({ ...base, regions: [{ kind: 'unprotected', bays: [3], base: 4, top: 10 }] })
        const bay3 = r.bayStatus.find((s) => s.bay === 3)
        expect(bay3.status).toBe('unprotected')
        expect(bay3.emitting).toEqual([{ base: 0, top: 18 }]) // whole face still emits
        expect(r.lockedBays).toContain(3)
    })

    it('protected + unprotected bands that overlap vertically are a conflict (apply neither)', () => {
        const r = buildEmitter({
            ...base,
            regions: [
                { kind: 'protected', bays: [5], base: 0, top: 10 },
                { kind: 'unprotected', bays: [5], base: 6, top: 14 },
            ],
        })
        expect(r.conflictBays).toContain(5)
        const bay5 = r.bayStatus.find((s) => s.bay === 5)
        expect(bay5.status).toBe('conflict')
        expect(bay5.emitting).toEqual([{ base: 0, top: 18 }]) // reverted to normal
    })

    it('protected + unprotected bands that DO NOT overlap compose (no conflict)', () => {
        const r = buildEmitter({
            ...base,
            regions: [
                { kind: 'protected', bays: [5], base: 0, top: 6 },   // protect lower
                { kind: 'unprotected', bays: [5], base: 10, top: 18 }, // keep upper open
            ],
        })
        expect(r.conflictBays).not.toContain(5)
        const bay5 = r.bayStatus.find((s) => s.bay === 5)
        expect(bay5.emitting).toEqual([{ base: 6, top: 18 }]) // lower 0..6 removed
        expect(r.lockedBays).toContain(5)
    })
})

describe('assessElevationBays with regions (#11)', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]

    it('matches the no-region result when no regions are supplied', () => {
        const a = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        expect(a.governingRequiredBoundaryDistance).toBeCloseTo(38.341, 1)
    })

    it('a protected region lowers required like protecting those bays', () => {
        const open = assessElevationBays({ wallPoints, boundaryPoints: [], height: 18, T, spacing: 8 })
        const withRegion = assessElevationBays({
            wallPoints, boundaryPoints: [], height: 18, T, spacing: 8,
            regions: [{ kind: 'protected', bays: [1, 2, 11, 12], base: 0, top: 18 }],
        })
        expect(withRegion.governingRequiredBoundaryDistance).toBeLessThan(open.governingRequiredBoundaryDistance)
        expect(withRegion.rows.find((r) => r.bay === 1).protected).toBe(true)
    })

    it('flags conflicts on the assessment', () => {
        const a = assessElevationBays({
            wallPoints, boundaryPoints: [], height: 18, T, spacing: 8,
            regions: [
                { kind: 'protected', bays: [6], base: 0, top: 10 },
                { kind: 'unprotected', bays: [6], base: 6, top: 14 },
            ],
        })
        expect(a.hasConflict).toBe(true)
        expect(a.conflictBays).toContain(6)
    })
})

describe('suggestProtection respects unprotected regions (#11)', () => {
    const wallPoints = [{ x: 0, y: 0 }, { x: 96, y: 0 }]
    const boundaryPoints = [{ x: 0, y: -30 }, { x: 96, y: -30 }]

    it('never auto-protects a bay carrying an unprotected band', () => {
        const r = suggestProtection({
            wallPoints, boundaryPoints, height: 18, T, spacing: 8,
            regions: [{ kind: 'unprotected', bays: [6, 7], base: 0, top: 18 }],
        })
        expect(r.protectedBays).not.toContain(6)
        expect(r.protectedBays).not.toContain(7)
    })
})

describe('gridlineStations — column positions along the wall', () => {
    it('places a station at 0, spacing, ... and the far edge', () => {
        const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]
        const st = gridlineStations(wall, 8)
        expect(st).toHaveLength(6) // 0,8,16,24,32,40
        expect(st[0].point).toEqual({ x: 0, y: 0 })
        expect(st[st.length - 1].point).toEqual({ x: 40, y: 0 })
        expect(st[2].point).toEqual({ x: 16, y: 0 })
    })
})
