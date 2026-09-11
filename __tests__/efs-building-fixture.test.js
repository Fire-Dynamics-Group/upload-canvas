import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
    splitIntoElevations,
    assessElevationBays,
    polylineLength,
    celsiusToKelvin,
} from '../utils/efsViewFactor'

// Regression cover on a real surveyed EFS building (rectangular outline + an
// irregular boundary polyline), the same `convertedPoints` shape the canvas
// produces. Locks the elevation split, per-face widths and the governing
// required boundary distance for the BR 187 view-factor method. Values were
// captured from the current engine; they are a regression guard, not a
// hand-derivation. Fixture: __tests__/fixtures/efs-building.json.
describe('EFS view-factor — real building fixture', () => {
    let wall
    let boundary
    let elevations

    beforeAll(() => {
        const fx = JSON.parse(
            readFileSync(join(__dirname, 'fixtures', 'efs-building.json'), 'utf-8'),
        )
        wall = fx.convertedPoints.find((e) => e.comments === 'efsWall')
        boundary = fx.convertedPoints.find((e) => e.comments === 'efsBoundary')
        elevations = splitIntoElevations(wall.finalPoints)
    })

    it('splits the rectangular outline into four elevations', () => {
        expect(elevations).toHaveLength(4)
        const widths = elevations.map((e) => polylineLength(e.points))
        expect(widths[0]).toBeCloseTo(238.1, 1)
        expect(widths[1]).toBeCloseTo(112.7, 1)
        expect(widths[2]).toBeCloseTo(238.1, 1)
        expect(widths[3]).toBeCloseTo(112.7, 1)
    })

    it('assesses each elevation against the shared boundary (no protection)', () => {
        const assess = (face) => assessElevationBays({
            wallPoints: face.points,
            boundaryPoints: boundary.finalPoints,
            height: 18,
            T: celsiusToKelvin(1040),
            spacing: 8,
            buildingPoints: wall.finalPoints,
        })

        const r = elevations.map(assess)

        // Bay counts follow width / 8 m column spacing.
        expect(r.map((x) => x.nBays)).toEqual([30, 15, 30, 15])

        // Governing required boundary distance per elevation.
        expect(r[0].governingRequiredBoundaryDistance).toBeCloseTo(51.53, 1)
        expect(r[1].governingRequiredBoundaryDistance).toBeCloseTo(40.78, 1)
        expect(r[2].governingRequiredBoundaryDistance).toBeCloseTo(51.57, 1)
        expect(r[3].governingRequiredBoundaryDistance).toBeCloseTo(40.78, 1)

        // The boundary is close on every face, so none pass unprotected.
        expect(r.every((x) => x.hasBoundary && x.allPass === false)).toBe(true)
    })

    it('protecting the boundary-facing bays lowers the governing distance on elevation 4', () => {
        const elev4 = elevations[3]
        const base = {
            wallPoints: elev4.points,
            boundaryPoints: boundary.finalPoints,
            height: 18,
            T: celsiusToKelvin(1040),
            spacing: 8,
            buildingPoints: wall.finalPoints,
        }
        const unprotected = assessElevationBays(base)
        const protectedRun = assessElevationBays({ ...base, protectedBays: [11, 12, 13, 14, 15] })
        expect(protectedRun.governingRequiredBoundaryDistance)
            .toBeLessThan(unprotected.governingRequiredBoundaryDistance)
    })
})
