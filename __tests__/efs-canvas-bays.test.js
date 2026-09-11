import { describe, it, expect } from 'vitest'
import { canvasBays, hitCanvasBay, assessCanvasElevation } from '../utils/efsCanvasBays'
import { buildEmitter, celsiusToKelvin, emissivePower, totalViewFactorPieces } from '../utils/efsViewFactor'

describe('canvas wall bays', () => {
    it('calculates column 4 from other emitting bays when span 3 is protected', () => {
        const state = { convertedPoints: [{ comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 24, y: 0 }] }], efsHeight: 18, efsColumnSpacing: 8, efsFireTempC: 1040, efsEndSpacingByElev: {}, efsRegionConfig: {}, efsProtectedByElev: { 0: [3] } }
        const result = assessCanvasElevation(state, 0)
        const column = result.columnRows[3]
        const { pieces } = buildEmitter({ width: 24, height: 18, spacing: 8, protectedBays: [3] })
        const flux = s => emissivePower(celsiusToKelvin(1040)) * totalViewFactorPieces(24, pieces, s, 9)
        expect(flux(0.0001)).toBeLessThan(12.6)
        expect(column.requiredBoundaryDistance).toBeGreaterThan(1)
        expect(flux(column.S)).toBeCloseTo(12.6, 3)
        expect(flux(column.S * 0.99)).toBeGreaterThan(12.6)
        expect(flux(column.S * 1.01)).toBeLessThan(12.6)
        expect(result.requiredByStation[3]).toBe(column.requiredBoundaryDistance)
    })
    it('splits at corners and retains the shorter final bay', () => {
        const bays = canvasBays([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }], 8, 10)
        expect(bays.map(b => b.length)).toEqual([8, 8, 4, 8, 2])
        expect(hitCanvasBay(bays, { x: 190, y: 2 }, 5)).toMatchObject({ elevation: 0, bay: 3 })
        expect(hitCanvasBay(bays, { x: 202, y: 90 }, 5)).toMatchObject({ elevation: 1, bay: 2 })
        expect(hitCanvasBay(bays, { x: 100, y: 50 }, 5)).toBeNull()
    })

    it('uses custom end spacing and rejects invalid scales', () => {
        const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
        const bays = canvasBays(points, 8, 10, { 0: { firstEnabled: true, firstSpacing: 3, lastEnabled: true, lastSpacing: 2 } })
        expect(bays[0].length).toBe(3)
        expect(bays.at(-1).length).toBe(2)
        expect(bays.reduce((sum, b) => sum + b.length, 0)).toBe(20)
        expect(canvasBays(points, 8, 0)).toEqual([])
    })

    it('recalculates required distance when protection is toggled', () => {
        const state = { convertedPoints: [{ comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 8, y: 0 }] }], efsHeight: 18, efsColumnSpacing: 8, efsFireTempC: 1040, efsEndSpacingByElev: {}, efsRegionConfig: {}, efsProtectedByElev: {} }
        const open = assessCanvasElevation(state, 0)
        const protectedResult = assessCanvasElevation({ ...state, efsProtectedByElev: { 0: [1] } }, 0)
        expect(open.rows[0].protected).toBe(false)
        expect(open.columnRows.map(r => r.column)).toEqual([1, 2])
        expect(open.columnRows.map(r => r.station)).toEqual([0, 8])
        expect(open.columnRows.map(r => r.requiredBoundaryDistance)).toEqual(open.requiredByStation)
        expect(protectedResult.rows[0].protected).toBe(true)
        expect(open.requiredByStation.some(s => s > 0)).toBe(true)
        expect(protectedResult.requiredByStation.every(s => s === 0)).toBe(true)
    })
})
