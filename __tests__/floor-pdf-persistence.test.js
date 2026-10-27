import { describe, it, expect } from 'vitest'
import { buildFdsPayload, hydrateFdsState } from '../store/fdsPersistence'
import { floorsToRebindPdf, floorHasPersistedPdf, pdfKeyFromUpload } from '../utils/floorPdfPersistence'

const sampleState = {
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
    elements: [],
    floors: [
        {
            id: 'floor-0',
            floor_number: 0,
            name: 'Ground Floor',
            z_level: 0,
            wall_height: 3,
            pdf_s3_key: 's3://plans/ground.pdf',
            hasCustomPdf: true,
            pdfSource: 'custom',
            elements: [],
            settings: {},
        },
        {
            id: 'floor-1-old',
            floor_number: 1,
            name: 'Level 1',
            z_level: 3,
            wall_height: 3,
            pdf_s3_key: 'uploaded_1',
            hasCustomPdf: true,
            pdfSource: 'custom',
            elements: [{ id: 1, type: 'polyline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], comments: 'obstruction' }],
            settings: { z_level: 3, wall_height: 3 },
        },
    ],
}

describe('buildFdsPayload keeps Level 1 plan keys', () => {
    it('sends pdf_s3_key / hasCustomPdf / pdfSource on every floor', () => {
        const p = buildFdsPayload(sampleState)
        expect(p.floors[1].pdf_s3_key).toBe('uploaded_1')
        expect(p.floors[1].hasCustomPdf).toBe(true)
        expect(p.floors[1].pdfSource).toBe('custom')
        expect(p.floors[0].pdf_s3_key).toBe('s3://plans/ground.pdf')
    })
})

describe('hydrateFdsState restores Level 1 plan keys', () => {
    it('round-trips pdf_s3_key from floor detail', () => {
        const project = { id: 'p1', name: 'Tower', settings: {} }
        const r = hydrateFdsState(project, [
            { id: 'floor-0', floor_number: 0, name: 'Ground Floor', pdf_s3_key: 's3://plans/ground.pdf', elements: [] },
            { id: 'floor-1', floor_number: 1, name: 'Level 1', pdf_s3_key: 's3://plans/level1.pdf', elements: [] },
        ], { currentMode: 'fdsGen', elementsByMode: { fdsGen: [] } })
        expect(r.floors[1].pdf_s3_key).toBe('s3://plans/level1.pdf')
        expect(r.floors[1].hasCustomPdf).toBe(true)
        expect(r.floors[1].pdfSource).toBe('custom')
    })
})

describe('floorsToRebindPdf', () => {
    it('rebinds Level 1 when save recreates the floor id and drops the key', () => {
        const rebind = floorsToRebindPdf(sampleState.floors, [
            { id: 'floor-0', floor_number: 0, pdf_s3_key: 's3://plans/ground.pdf' },
            { id: 'floor-1-new', floor_number: 1, pdf_s3_key: null },
        ])
        expect(rebind).toEqual([
            { floorNumber: 1, floorIndex: 1, floorId: 'floor-1-new', pdfSource: 'custom' },
        ])
    })

    it('does not rebind when the server kept the same id and key', () => {
        expect(floorsToRebindPdf(sampleState.floors, [
            { id: 'floor-0', floor_number: 0, pdf_s3_key: 's3://plans/ground.pdf' },
            { id: 'floor-1-old', floor_number: 1, pdf_s3_key: 'uploaded_1' },
        ])).toEqual([])
    })
})

describe('floorHasPersistedPdf / pdfKeyFromUpload', () => {
    it('treats a dedicated Level 1 upload as persisted', () => {
        expect(floorHasPersistedPdf({ hasCustomPdf: true, pdfSource: 'custom' })).toBe(true)
        expect(floorHasPersistedPdf({ pdfSource: 'ground' })).toBe(true)
        expect(floorHasPersistedPdf({ elements: [] })).toBe(false)
    })

    it('prefers the key the upload endpoint returned', () => {
        expect(pdfKeyFromUpload({ pdf_s3_key: 'real-key' }, 1)).toBe('real-key')
        expect(pdfKeyFromUpload({}, 1)).toBe('uploaded_1')
    })
})
