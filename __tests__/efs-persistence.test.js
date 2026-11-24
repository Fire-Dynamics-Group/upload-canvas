import { describe, it, expect } from 'vitest'
import {
    EFS_SETTINGS_DEFAULTS,
    buildEfsPayload,
    hydrateEfsState,
    efsAutosaveSnapshot,
} from '../store/efsPersistence'
import { MODE_PERSISTENCE } from '../store/persistenceModes'

describe('EFS persistence handlers', () => {
    const sampleState = {
        currentMode: 'efs',
        projectName: 'Site EFS',
        thumbnail: 'data:image/jpeg;base64,abc',
        canvasDimensions: { width: 1200, height: 800 },
        pixelsPerMesh: 2.5,
        originPixels: { x: 100, y: 700 },
        elements: [
            { id: 1, type: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], comments: 'efsWall' },
            { id: 2, type: 'polyline', points: [{ x: 0, y: 50 }, { x: 10, y: 50 }], comments: 'efsBoundary' },
        ],
        elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
        efsColumnSpacing: 6,
        efsHeight: 12,
        efsFireTempC: 900,
        efsSprinklered: true,
        efsCornersFirst: false,
        efsActiveElevation: 1,
        efsProtectedByElev: { 0: [1, 3] },
        efsRequiredByElev: { 0: [4.2, 5.1] },
        efsEndSpacingByElev: { 0: { firstEnabled: true, firstSpacing: 4 } },
        efsRegionConfig: { 99: { base: 1, top: 6 } },
        efsCalcDone: true,
        efsShowScaleGrid: false,
        efsShowDistanceArrows: false,
        efsShowDistances: true,
        efsShowGridSquares: false,
        efsShowGridNumbers: true,
        efsWallLineWidth: 8,
        efsBoundaryLineWidth: 3,
        efsNeededBoundaryLineWidth: 5,
        efsArrowLineWidth: 2,
    }

    it('wires efs handlers on MODE_PERSISTENCE with dbBacked: true', () => {
        expect(MODE_PERSISTENCE.efs.dbBacked).toBe(true)
        expect(MODE_PERSISTENCE.efs.buildPayload).toBe(buildEfsPayload)
        expect(MODE_PERSISTENCE.efs.hydrate).toBe(hydrateEfsState)
        expect(MODE_PERSISTENCE.efs.snapshot).toBe(efsAutosaveSnapshot)
    })

    it('round-trips EFS geometry, calc settings, and display options through build/hydrate', () => {
        const payload = buildEfsPayload(sampleState)
        expect(payload.name).toBe('Site EFS')
        expect(payload.floors).toHaveLength(1)
        expect(payload.floors[0].name).toBe('Site Plan')
        expect(payload.floors[0].elements).toHaveLength(2)
        expect(payload.settings.efsSettings.efsColumnSpacing).toBe(6)
        expect(payload.settings.efsSettings.efsShowScaleGrid).toBe(false)
        expect(payload.settings.efsSettings.efsWallLineWidth).toBe(8)

        const hydrated = hydrateEfsState(
            { id: 'proj-1', name: 'Site EFS', settings: payload.settings },
            {
                id: 'floor-1',
                canvas_dimensions: payload.floors[0].canvas_dimensions,
                pixels_per_mesh: payload.floors[0].pixels_per_mesh,
                origin_pixels: payload.floors[0].origin_pixels,
                elements: payload.floors[0].elements,
            },
            { currentMode: 'efs', elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] } },
        )

        expect(hydrated.projectId).toBe('proj-1')
        expect(hydrated.floorId).toBe('floor-1')
        expect(hydrated.elements).toEqual(sampleState.elements)
        expect(hydrated.elementsByMode.efs).toEqual(sampleState.elements)
        expect(hydrated.efsColumnSpacing).toBe(6)
        expect(hydrated.efsProtectedByElev).toEqual({ 0: [1, 3] })
        expect(hydrated.efsShowScaleGrid).toBe(false)
        expect(hydrated.efsWallLineWidth).toBe(8)
        expect(hydrated.efsArrowLineWidth).toBe(2)
    })

    it('falls back to EFS_SETTINGS_DEFAULTS when opening a project without efsSettings', () => {
        const hydrated = hydrateEfsState(
            { id: 'proj-2', name: 'Blank EFS', settings: {} },
            { id: 'floor-2', elements: [] },
            { currentMode: 'efs', elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] } },
        )

        for (const [key, val] of Object.entries(EFS_SETTINGS_DEFAULTS)) {
            expect(hydrated[key]).toEqual(val)
        }
    })

    it('includes display options and geometry in efsAutosaveSnapshot', () => {
        const snap = efsAutosaveSnapshot(sampleState)
        expect(snap.elements).toBe(sampleState.elements)
        expect(snap.efsShowScaleGrid).toBe(false)
        expect(snap.efsWallLineWidth).toBe(8)
        expect(snap.efsProtectedByElev).toEqual({ 0: [1, 3] })
    })
})
