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

describe('boundaryDistanceOutward — closest on the outward side (diagonal allowed)', () => {
    const wall = [{ x: 0, y: 0 }, { x: 40, y: 0 }]

    it('is perpendicular for a parallel boundary (closest happens to be straight out)', () => {
        const boundary = [{ x: -10, y: -20 }, { x: 50, y: -20 }] // parallel, below
        const r = boundaryDistanceOutward(wall, 20, boundary) // gridline at (20,0)
        expect(r.outward).toBe(true)
        expect(r.distance).toBeCloseTo(20, 6)
        expect(r.point.x).toBeCloseTo(20, 6)
        expect(r.point.y).toBeCloseTo(-20, 6)
    })

    it('takes the closest boundary point even when it is diagonal, not perpendicular', () => {
        const boundary = [{ x: 0, y: -10 }, { x: 0, y: -50 }] // off to the left, below
        const r = boundaryDistanceOutward(wall, 40, boundary) // from the right end (40,0)
        expect(r.outward).toBe(true)
        expect(r.point.x).toBeCloseTo(0, 4)
        expect(r.point.y).toBeCloseTo(-10, 4)
        expect(r.distance).toBeCloseTo(Math.hypot(40, 10), 4) // diagonal, ~41.2
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
