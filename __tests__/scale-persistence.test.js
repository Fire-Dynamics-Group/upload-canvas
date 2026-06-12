import { describe, it, expect } from 'vitest'
import { buildFdsPayload, hydrateFdsState } from '../store/fdsPersistence'
import { derivePixelsPerMesh, DEFAULT_RENDER_SCALE } from '../utils/scaleCalibration'

// Issue #15 — the intrinsic calibration round-trips through the floor `settings`
// JSON (no DB migration), pixelsPerMesh is derived on hydrate, and old projects
// saved with only `pixels_per_mesh` still load with a sensible scale.

const calibration = {
    pagePointsPerMesh: 4,
    points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    lengthMeters: 5,
}

const baseState = {
    projectName: 'Tower', scenarioType: 'MOE', simEndTime: 300, totalFloors: 8,
    wallHeight: 3, stairRoofZ: 25, topStoreyHeight: 20, fireFloorZ: 0, fireFloorNumber: 0,
    commonCorridorMode: false, includeSensors: true, corridorSensorHeights: [2.0],
    stairSensorHeights: [0.5], fsaSensorHeights: [1.5], isSprinklered: true, doorOpenings: {},
    aovMode: 'always_open', aovActivationTime: null, obstructionTransparency: {},
    totalHeatFlux: 476, heatEndpoint: 1.3333, fireHRR: 1000, fireDimension: 1.4,
    fireHeightAboveFloor: 0.5, fireBase: 0.0, fireType: 'growing', fireGrowthRate: 'medium',
    fireCustomAlpha: null, numberOfStairs: 0, stairObject: [], thumbnail: null,
    canvasDimensions: { width: 100, height: 100 }, originPixels: null,
    doorRoles: {}, doorLeakagesEnabled: true, doorLeakageConfig: {}, landingRoles: {},
    landingUpSide: null, stairStyle: 'individual', extractConfig: {}, inletConfig: {},
    zoneConfig: {}, sliceZHeight: 2.0,
    elements: [{ id: 0, type: 'rect', points: [[0, 0]], comments: 'mesh' }],
}

describe('buildFdsPayload — intrinsic scale', () => {
    it('writes the calibration into the floor settings JSON (no schema change)', () => {
        const p = buildFdsPayload({
            ...baseState,
            scaleCalibration: calibration,
            pixelsPerMesh: 6,
        })
        expect(p.floors[0].settings.scaleCalibration).toEqual(calibration)
        // The derived pixels value is still written for back-compat / safeguards.
        expect(p.floors[0].pixels_per_mesh).toBe(6)
    })
})

describe('hydrateFdsState — intrinsic scale', () => {
    const project = { id: 'p1', name: 'Tower', settings: {} }
    const stateArg = { currentMode: 'fdsGen', renderScale: DEFAULT_RENDER_SCALE, elementsByMode: { fdsGen: [] } }

    it('restores the calibration and DERIVES pixelsPerMesh from it', () => {
        const floorDetail = {
            id: 'f1', canvas_dimensions: {}, pixels_per_mesh: 6, origin_pixels: null,
            settings: { scaleCalibration: calibration }, elements: [],
        }
        const r = hydrateFdsState(project, floorDetail, stateArg)
        expect(r.scaleCalibration).toEqual(calibration)
        // 4 page-pts/mesh × 1.5 render scale = 6 render px/mesh.
        expect(r.pixelsPerMesh).toBeCloseTo(derivePixelsPerMesh(calibration, DEFAULT_RENDER_SCALE), 10)
    })

    it('round-trips: save then hydrate reproduces the same real-world scale', () => {
        const payload = buildFdsPayload({ ...baseState, scaleCalibration: calibration, pixelsPerMesh: 6 })
        const floorDetail = { ...payload.floors[0], id: 'f1', origin_pixels: null }
        const r = hydrateFdsState(project, floorDetail, stateArg)
        expect(r.scaleCalibration).toEqual(calibration)
        expect(r.pixelsPerMesh).toBeCloseTo(6, 10)
    })

    it('is render-independent: hydrating at a different render scale yields the same real scale (no drift)', () => {
        const floorDetail = {
            id: 'f1', canvas_dimensions: {}, pixels_per_mesh: 6, origin_pixels: null,
            settings: { scaleCalibration: calibration }, elements: [],
        }
        const atHigh = hydrateFdsState(project, floorDetail, { ...stateArg, renderScale: 3.0 })
        // pixelsPerMesh doubles with render scale, but pagePointsPerMesh (the real
        // scale) is identical — that's the device-independence guarantee.
        expect(atHigh.pixelsPerMesh).toBeCloseTo(12, 10)
        expect(atHigh.scaleCalibration.pagePointsPerMesh).toBe(calibration.pagePointsPerMesh)
    })

    it('back-compat: a project saved with only the old pixels_per_mesh still loads with a sensible scale', () => {
        const floorDetail = {
            id: 'f1', canvas_dimensions: {}, pixels_per_mesh: 6, origin_pixels: null,
            settings: {}, elements: [],
        }
        const r = hydrateFdsState(project, floorDetail, stateArg)
        // Reconstructed intrinsic calibration reproduces the legacy pixel value.
        expect(r.pixelsPerMesh).toBeCloseTo(6, 10)
        expect(r.scaleCalibration.pagePointsPerMesh).toBeCloseTo(4, 10)
        expect(r.scaleCalibration.points).toBeNull() // no line to "Change length" from
    })

    it('an unset legacy scale (1) hydrates to no calibration and the unset sentinel', () => {
        const floorDetail = {
            id: 'f1', canvas_dimensions: {}, pixels_per_mesh: 1, origin_pixels: null,
            settings: {}, elements: [],
        }
        const r = hydrateFdsState(project, floorDetail, stateArg)
        expect(r.scaleCalibration).toBeNull()
        expect(r.pixelsPerMesh).toBe(1)
    })
})
