import { describe, it, expect } from 'vitest'
import {
    MESH_METERS,
    DEFAULT_RENDER_SCALE,
    buildCalibration,
    recalibrateLength,
    derivePixelsPerMesh,
    calibrationFromLegacyPixels,
    pagePointToPixel,
    formatScale,
} from '../utils/scaleCalibration'

// Issue #15 — calibration is stored in PDF-intrinsic units (page points), so the
// real-world scale is invariant to render scale / DPI / device. pixelsPerMesh is
// always DERIVED from the intrinsic value × the current render scale.

describe('buildCalibration', () => {
    it('stores the line in page points (render-independent) and the entered length', () => {
        // 300 render px apart at renderScale 1.5 -> 200 page points apart.
        const cal = buildCalibration({ x: 0, y: 0 }, { x: 300, y: 0 }, 5, 1.5)
        expect(cal.points).toEqual([{ x: 0, y: 0 }, { x: 200, y: 0 }])
        expect(cal.lengthMeters).toBe(5)
        // 200 page points = 5 m -> per 0.1 m = 200 * 0.1 / 5 = 4 page points / mesh
        expect(cal.pagePointsPerMesh).toBeCloseTo(4, 10)
    })

    it('is invariant to the render scale it was captured at (no drift)', () => {
        // Same real-world line measured at two different render scales must yield
        // the same intrinsic pagePointsPerMesh.
        const atLow = buildCalibration({ x: 0, y: 0 }, { x: 200, y: 0 }, 5, 1.0)
        const atHigh = buildCalibration({ x: 0, y: 0 }, { x: 600, y: 0 }, 5, 3.0)
        expect(atHigh.pagePointsPerMesh).toBeCloseTo(atLow.pagePointsPerMesh, 10)
    })
})

describe('derivePixelsPerMesh', () => {
    it('derives render pixels from the intrinsic value and the current render scale', () => {
        const cal = { pagePointsPerMesh: 4 }
        expect(derivePixelsPerMesh(cal, 1.5)).toBeCloseTo(6, 10)
        // Re-render at a different scale -> different render px, SAME real scale.
        expect(derivePixelsPerMesh(cal, 3.0)).toBeCloseTo(12, 10)
    })

    it('returns the unset sentinel (1) for a null/blank calibration', () => {
        expect(derivePixelsPerMesh(null, 1.5)).toBe(1)
        expect(derivePixelsPerMesh({ pagePointsPerMesh: 0 }, 1.5)).toBe(1)
    })

    it('round-trips: buildCalibration then derive at the same scale reproduces the legacy pixelsPerMesh', () => {
        // Legacy formula was pixels / (lengthMeters / 0.1). At renderScale 1.5 the
        // intrinsic path must reproduce it exactly.
        const p1 = { x: 10, y: 10 }, p2 = { x: 310, y: 10 } // 300 render px
        const legacy = 300 / (5 / MESH_METERS) // = 6
        const cal = buildCalibration(p1, p2, 5, 1.5)
        expect(derivePixelsPerMesh(cal, 1.5)).toBeCloseTo(legacy, 10)
    })
})

describe('recalibrateLength (Change length without re-clicking — issue #19)', () => {
    it('recomputes the scale from the stored line and a new length', () => {
        const cal = buildCalibration({ x: 0, y: 0 }, { x: 200, y: 0 }, 5, 1.0)
        // Same line now declared to be 10 m instead of 5 m -> half the scale.
        const next = recalibrateLength(cal, 10)
        expect(next.points).toEqual(cal.points) // line unchanged, no re-click
        expect(next.lengthMeters).toBe(10)
        expect(next.pagePointsPerMesh).toBeCloseTo(cal.pagePointsPerMesh / 2, 10)
    })
})

describe('calibrationFromLegacyPixels (back-compat — issue #15)', () => {
    it('reconstructs an intrinsic calibration so derive reproduces the old value', () => {
        const cal = calibrationFromLegacyPixels(6, 1.5)
        expect(cal.pagePointsPerMesh).toBeCloseTo(4, 10)
        expect(derivePixelsPerMesh(cal, 1.5)).toBeCloseTo(6, 10)
        // No stored line for an old project, so "Change length" can't be offered.
        expect(cal.points).toBeNull()
    })

    it('treats the unset sentinel (1) and missing values as no calibration', () => {
        expect(calibrationFromLegacyPixels(1, 1.5)).toBeNull()
        expect(calibrationFromLegacyPixels(0, 1.5)).toBeNull()
        expect(calibrationFromLegacyPixels(undefined, 1.5)).toBeNull()
    })
})

describe('pagePointToPixel (redraw the stored line — issue #19)', () => {
    it('maps a stored page-point back to render pixels at the current scale', () => {
        expect(pagePointToPixel({ x: 200, y: 100 }, 1.5)).toEqual({ x: 300, y: 150 })
    })
})

describe('formatScale (human-readable re-entry panel — issue #19)', () => {
    it('renders "1.00 m = N px" from the derived pixelsPerMesh', () => {
        // pixelsPerMesh is px per 0.1 m, so 1 m = 10× that.
        expect(formatScale(6)).toBe('1.00 m = 60 px')
    })
})

describe('constants', () => {
    it('a mesh unit is 0.1 m and the default render scale is 1.5', () => {
        expect(MESH_METERS).toBe(0.1)
        expect(DEFAULT_RENDER_SCALE).toBe(1.5)
    })
})
