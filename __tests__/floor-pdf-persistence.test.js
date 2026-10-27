// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'
import { buildFdsPayload, hydrateFdsState } from '../store/fdsPersistence'
import { getSyncedFloors } from '../utils/multiFloorFds'
import {
    floorHasPersistedPdf,
    pdfKeyFromUpload,
    isPlaceholderPdfKey,
    payloadPdfS3Key,
    floorsToRebindPdf,
    chooseFloorPdfRestoreSource,
} from '../utils/floorPdfPersistence'

const REAL_GROUND_KEY = 'projects/p1/floors/floor-0/plan.pdf'
const REAL_LEVEL1_KEY = 'projects/p1/floors/floor-1-old/plan.pdf'

function twoFloorState(level1Patch = {}) {
    return {
        projectName: 'Tower',
        currentMode: 'fdsGen',
        scenarioType: 'MOE', simEndTime: 300, totalFloors: 8, wallHeight: 3,
        stairRoofZ: 25, topStoreyHeight: 20, fireFloorZ: 0, fireFloorNumber: 0,
        commonCorridorMode: false, includeSensors: true,
        corridorSensorHeights: [2.0], stairSensorHeights: [0.5], fsaSensorHeights: [1.5],
        isSprinklered: true, doorOpenings: {}, aovMode: 'always_open', aovActivationTime: null,
        obstructionTransparency: {}, totalHeatFlux: 476, heatEndpoint: 1.3333,
        fireHRR: 1000, fireDimension: 1.4, fireHeightAboveFloor: 0.5, fireBase: 0.0,
        fireType: 'growing', fireGrowthRate: 'medium', fireCustomAlpha: null,
        numberOfStairs: 0, stairObject: [], thumbnail: null,
        canvasDimensions: { width: 1000, height: 800 }, pixelsPerMesh: 33.6, originPixels: null,
        doorRoles: {}, doorLeakagesEnabled: true, doorLeakageConfig: {},
        landingRoles: {}, landingUpSide: null, stairStyle: 'individual',
        extractConfig: {}, inletConfig: {}, zoneConfig: {}, sliceZHeight: 2.0,
        activeFloorIndex: 1,
        elements: [{ id: 1, type: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], comments: 'obstruction' }],
        floors: [
            {
                id: 'floor-0',
                floor_number: 0,
                name: 'Ground Floor',
                z_level: 0,
                wall_height: 3,
                pdf_s3_key: REAL_GROUND_KEY,
                hasCustomPdf: true,
                pdfSource: 'custom',
                elements: [{ id: 0, type: 'rect', points: [{ x: 0, y: 0 }], comments: 'mesh' }],
                settings: {},
            },
            {
                id: 'floor-1-old',
                floor_number: 1,
                name: 'Level 1',
                z_level: 3,
                wall_height: 3,
                pdf_s3_key: REAL_LEVEL1_KEY,
                hasCustomPdf: true,
                pdfSource: 'custom',
                elements: [{ id: 1, type: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], comments: 'obstruction' }],
                settings: { z_level: 3, wall_height: 3 },
                ...level1Patch,
            },
        ],
    }
}

/** Models POST /save: FloorSavePayload has no pdf_s3_key, so new/recreated rows lose it. */
function serverFloorsFromSave(payload, { recreateIds = true, preserveExistingKeys = {} } = {}) {
    return payload.floors.map((f) => ({
        id: recreateIds ? `srv-${f.floor_number}` : f.id || `srv-${f.floor_number}`,
        floor_number: f.floor_number,
        name: f.name,
        pdf_s3_key: preserveExistingKeys[f.floor_number] ?? null,
        settings: f.settings,
        elements: f.elements,
        canvas_dimensions: f.canvas_dimensions,
        pixels_per_mesh: f.pixels_per_mesh,
        origin_pixels: f.origin_pixels,
    }))
}

describe('buildFdsPayload keeps Level 1 plan keys', () => {
    it('sends pdf_s3_key on every floor that has a real S3 object', () => {
        const p = buildFdsPayload(twoFloorState())
        expect(p.floors[1].pdf_s3_key).toBe(REAL_LEVEL1_KEY)
        expect(p.floors[0].pdf_s3_key).toBe(REAL_GROUND_KEY)
        // Frontend-only flags belong in settings, not as extra FloorSavePayload fields.
        expect(p.floors[1].hasCustomPdf).toBeUndefined()
        expect(p.floors[1].pdfSource).toBeUndefined()
    })

    it('does not send the fake uploaded_N placeholder as pdf_s3_key', () => {
        const p = buildFdsPayload(twoFloorState({ pdf_s3_key: 'uploaded_1' }))
        expect(p.floors[1].pdf_s3_key).toBeNull()
        expect(isPlaceholderPdfKey(p.floors[1].pdf_s3_key)).toBe(false)
    })

    it('round-trips pdfSource / hasCustomPdf through floor settings so hydrate can restore them', () => {
        const reused = buildFdsPayload(twoFloorState({
            pdf_s3_key: null,
            hasCustomPdf: true,
            pdfSource: 'ground',
        }))
        expect(reused.floors[1].settings.pdfSource).toBe('ground')
        expect(reused.floors[1].settings.hasCustomPdf).toBe(true)
    })
})

describe('hydrateFdsState restores Level 1 plan keys', () => {
    it('round-trips pdf_s3_key from floor detail', () => {
        const project = { id: 'p1', name: 'Tower', settings: {} }
        const r = hydrateFdsState(project, [
            { id: 'floor-0', floor_number: 0, name: 'Ground Floor', pdf_s3_key: REAL_GROUND_KEY, elements: [] },
            { id: 'floor-1', floor_number: 1, name: 'Level 1', pdf_s3_key: REAL_LEVEL1_KEY, elements: [] },
        ], { currentMode: 'fdsGen', elementsByMode: { fdsGen: [] } })
        expect(r.floors[1].pdf_s3_key).toBe(REAL_LEVEL1_KEY)
        expect(r.floors[1].hasCustomPdf).toBe(true)
        expect(r.floors[1].pdfSource).toBe('custom')
    })

    it('restores reused-Ground metadata from settings when the S3 key is still empty', () => {
        const r = hydrateFdsState(
            { id: 'p1', name: 'Tower', settings: {} },
            [
                { id: 'floor-0', floor_number: 0, pdf_s3_key: REAL_GROUND_KEY, elements: [] },
                {
                    id: 'floor-1',
                    floor_number: 1,
                    pdf_s3_key: null,
                    settings: { hasCustomPdf: true, pdfSource: 'ground' },
                    elements: [],
                },
            ],
            { currentMode: 'fdsGen', elementsByMode: { fdsGen: [] } }
        )
        expect(r.floors[1].hasCustomPdf).toBe(true)
        expect(r.floors[1].pdfSource).toBe('ground')
    })
})

describe('floorsToRebindPdf', () => {
    it('rebinds Level 1 when save recreates the floor id and drops the key', () => {
        const local = twoFloorState().floors
        const rebind = floorsToRebindPdf(local, [
            { id: 'floor-0', floor_number: 0, pdf_s3_key: REAL_GROUND_KEY },
            { id: 'floor-1-new', floor_number: 1, pdf_s3_key: null },
        ])
        expect(rebind).toEqual([
            { floorNumber: 1, floorIndex: 1, floorId: 'floor-1-new', pdfSource: 'custom' },
        ])
    })

    it('rebinds a brand-new Level 1 whose local id was still null after first save', () => {
        const local = [
            { id: 'floor-0', floor_number: 0, pdf_s3_key: REAL_GROUND_KEY, hasCustomPdf: true, pdfSource: 'custom' },
            { id: null, floor_number: 1, pdf_s3_key: null, hasCustomPdf: true, pdfSource: 'ground' },
        ]
        const rebind = floorsToRebindPdf(local, [
            { id: 'srv-0', floor_number: 0, pdf_s3_key: REAL_GROUND_KEY },
            { id: 'srv-1', floor_number: 1, pdf_s3_key: null },
        ])
        expect(rebind).toEqual([
            { floorNumber: 1, floorIndex: 1, floorId: 'srv-1', pdfSource: 'ground' },
        ])
    })

    it('does not rebind when the server kept the same id and key', () => {
        expect(floorsToRebindPdf(twoFloorState().floors, [
            { id: 'floor-0', floor_number: 0, pdf_s3_key: REAL_GROUND_KEY },
            { id: 'floor-1-old', floor_number: 1, pdf_s3_key: REAL_LEVEL1_KEY },
        ])).toEqual([])
    })
})

describe('floorHasPersistedPdf / pdfKeyFromUpload / restore order', () => {
    it('treats a dedicated Level 1 upload and a reused Ground PDF as persisted', () => {
        expect(floorHasPersistedPdf({ hasCustomPdf: true, pdfSource: 'custom' })).toBe(true)
        expect(floorHasPersistedPdf({ pdfSource: 'ground' })).toBe(true)
        expect(floorHasPersistedPdf({ elements: [] })).toBe(false)
    })

    it('prefers the key the upload endpoint returned and ignores uploaded_N', () => {
        expect(pdfKeyFromUpload({ pdf_s3_key: REAL_LEVEL1_KEY }, 1)).toBe(REAL_LEVEL1_KEY)
        expect(payloadPdfS3Key({ pdf_s3_key: 'uploaded_1' })).toBeNull()
        expect(isPlaceholderPdfKey('uploaded_1')).toBe(true)
        expect(isPlaceholderPdfKey(REAL_LEVEL1_KEY)).toBe(false)
    })

    it('restores cache, then IndexedDB, then S3', () => {
        expect(chooseFloorPdfRestoreSource({ hasCache: true, hasIndexedDb: true, canFetchS3: true })).toBe('cache')
        expect(chooseFloorPdfRestoreSource({ hasCache: false, hasIndexedDb: true, canFetchS3: true })).toBe('indexeddb')
        expect(chooseFloorPdfRestoreSource({ hasCache: false, hasIndexedDb: false, canFetchS3: true })).toBe('s3')
        expect(chooseFloorPdfRestoreSource({ hasCache: false, hasIndexedDb: false, canFetchS3: false })).toBe('blank')
    })
})

describe('Level 1 plan survives save + floor switch + reload hydration', () => {
    beforeEach(() => {
        useStore.getState().resetProject()
        useStore.setState({ currentMode: 'fdsGen', projectId: 'p1', projectName: 'Tower' })
    })

    it('keeps a dedicated Level 1 PDF through a delete-recreate save and hydrate onto Ground then switch', () => {
        useStore.getState().addElement({
            id: 0, type: 'rect', comments: 'mesh',
            points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        })
        useStore.getState().updateFloorMeta(0, {
            id: 'floor-0',
            pdf_s3_key: REAL_GROUND_KEY,
            hasCustomPdf: true,
            pdfSource: 'custom',
        })
        useStore.getState().addFloor({ name: 'Level 1' })
        useStore.getState().addElement({
            id: 1, type: 'polyline', comments: 'obstruction',
            points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        })
        useStore.getState().updateFloorMeta(1, {
            id: 'floor-1-old',
            pdf_s3_key: REAL_LEVEL1_KEY,
            hasCustomPdf: true,
            pdfSource: 'custom',
        })

        const localFloors = getSyncedFloors(useStore.getState())
        const payload = buildFdsPayload(useStore.getState())
        expect(payload.floors[1].pdf_s3_key).toBe(REAL_LEVEL1_KEY)

        // Backend currently ignores payload.pdf_s3_key; a recreate/new row has none.
        const savedFloors = serverFloorsFromSave(payload, { recreateIds: true })
        expect(savedFloors[1].id).not.toBe('floor-1-old')
        expect(savedFloors[1].pdf_s3_key).toBeNull()

        const rebind = floorsToRebindPdf(localFloors, savedFloors)
        expect(rebind.map((r) => r.floorNumber)).toEqual([0, 1])
        expect(rebind[1].floorId).toBe('srv-1')

        const rebound = savedFloors.map((sf) => {
            const item = rebind.find((r) => r.floorNumber === sf.floor_number)
            if (!item) return sf
            return {
                ...sf,
                pdf_s3_key: `projects/p1/floors/${sf.id}/plan.pdf`,
                settings: {
                    ...(sf.settings || {}),
                    hasCustomPdf: true,
                    pdfSource: item.pdfSource,
                },
            }
        })

        const hydrated = hydrateFdsState(
            { id: 'p1', name: 'Tower', settings: payload.settings },
            rebound,
            { currentMode: 'fdsGen', elementsByMode: { fdsGen: [] } }
        )
        expect(hydrated.activeFloorIndex).toBe(0)
        expect(hydrated.floors[0].pdf_s3_key).toContain('/floors/srv-0/')
        expect(hydrated.floors[1].pdf_s3_key).toContain('/floors/srv-1/')
        expect(hydrated.floors[1].hasCustomPdf).toBe(true)
        expect(hydrated.floors[1].pdfSource).toBe('custom')

        useStore.getState().hydrateFromServer(
            { id: 'p1', name: 'Tower', settings: payload.settings },
            rebound
        )
        useStore.getState().setActiveFloor(1)
        const level1 = useStore.getState().floors[1]
        expect(level1.pdf_s3_key).toContain('/floors/srv-1/')
        expect(level1.hasCustomPdf).toBe(true)
        expect(chooseFloorPdfRestoreSource({
            hasCache: false,
            hasIndexedDb: true,
            canFetchS3: Boolean(level1.pdf_s3_key && level1.id),
        })).toBe('indexeddb')
    })

    it('treats reusing Ground’s PDF as a persisted Level 1 plan, not session-only', () => {
        useStore.getState().addFloor({ name: 'Level 1' })
        useStore.getState().updateFloorMeta(1, {
            id: null,
            hasCustomPdf: true,
            pdfSource: 'ground',
        })

        const localFloors = getSyncedFloors(useStore.getState())
        expect(floorHasPersistedPdf(localFloors[1])).toBe(true)

        const payload = buildFdsPayload(useStore.getState())
        expect(payload.floors[1].settings.pdfSource).toBe('ground')
        expect(payload.floors[1].settings.hasCustomPdf).toBe(true)

        const savedFloors = serverFloorsFromSave(payload, { recreateIds: false })
        const rebind = floorsToRebindPdf(localFloors, savedFloors)
        expect(rebind).toEqual([
            expect.objectContaining({ floorNumber: 1, floorId: 'srv-1', pdfSource: 'ground' }),
        ])
    })
})
