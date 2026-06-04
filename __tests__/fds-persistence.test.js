import { describe, it, expect } from 'vitest'
import { buildFdsPayload, hydrateFdsState } from '../store/fdsPersistence'
import { MODE_PERSISTENCE } from '../store/persistenceModes'

// Phase 3: per-mode save/hydrate handlers live on the registry as pure
// functions. fdsGen is the first registered handler; onboarding another mode
// later means writing its handler + flipping the flag, with no edits here.

const sampleState = {
    projectName: 'Tower',
    scenarioType: 'MOE', simEndTime: 300, totalFloors: 8, wallHeight: 3,
    stairRoofZ: 25, topStoreyHeight: 20, fireFloorZ: 0, fireFloorNumber: 0,
    commonCorridorMode: false, includeSensors: true,
    corridorSensorHeights: [2.0], stairSensorHeights: [0.5], fsaSensorHeights: [1.5],
    isSprinklered: true, doorOpenings: {}, aovMode: 'always_open', aovActivationTime: null,
    obstructionTransparency: {}, totalHeatFlux: 476, heatEndpoint: 1.3333,
    fireHRR: 1000, fireDimension: 1.4, fireHeightAboveFloor: 0.5, fireBase: 0.0,
    fireType: 'growing', fireGrowthRate: 'medium', fireCustomAlpha: null,
    numberOfStairs: 0, stairObject: [], thumbnail: null,
    canvasDimensions: { w: 1 }, pixelsPerMesh: 33.6, originPixels: null,
    doorRoles: { d1: 'stair' }, doorLeakagesEnabled: true, doorLeakageConfig: {},
    landingRoles: {}, landingUpSide: null, stairStyle: 'individual',
    extractConfig: {}, inletConfig: {}, zoneConfig: {}, sliceZHeight: 2.0,
    elements: [{ id: 5, type: 'rect', points: [[0, 0]], comments: 'mesh' }],
}

describe('buildFdsPayload', () => {
    it('maps state into the project/floor save payload', () => {
        const p = buildFdsPayload(sampleState)
        expect(p.name).toBe('Tower')
        expect(p.settings.scenarioType).toBe('MOE')
        expect(p.settings.numberOfStairs).toBe(0)
        const floor = p.floors[0]
        expect(floor.floor_number).toBe(0)
        expect(floor.pixels_per_mesh).toBe(33.6)
        expect(floor.settings.doorRoles).toEqual({ d1: 'stair' })
        expect(floor.elements).toEqual([
            { element_index: 5, type: 'rect', points: [[0, 0]], comments: 'mesh' },
        ])
    })

    it('falls back to a default project name', () => {
        expect(buildFdsPayload({ ...sampleState, projectName: null }).name)
            .toBe('Untitled Project')
    })
})

describe('hydrateFdsState', () => {
    const project = { id: 'p1', name: 'Tower', settings: { scenarioType: 'FSA' } }
    const floorDetail = {
        id: 'f1',
        settings: { doorRoles: { d1: 'leakage' } },
        canvas_dimensions: { w: 2 },
        pixels_per_mesh: 10,
        origin_pixels: null,
        elements: [{ element_index: 3, type: 'point', points: [[1, 1]], comments: 'fire' }],
    }
    const base = { currentMode: 'fdsGen', elementsByMode: { fdsGen: [], radiation: [], timeEq: [] } }

    it('restores project + floor settings with defaults for missing keys', () => {
        const r = hydrateFdsState(project, floorDetail, base)
        expect(r.projectId).toBe('p1')
        expect(r.floorId).toBe('f1')
        expect(r.scenarioType).toBe('FSA')
        expect(r.totalFloors).toBe(8) // default applied
        expect(r.doorRoles).toEqual({ d1: 'leakage' })
    })

    it('loads elements into both the live array and the active bucket', () => {
        const r = hydrateFdsState(project, floorDetail, base)
        expect(r.elements).toEqual([
            { id: 3, type: 'point', points: [[1, 1]], comments: 'fire' },
        ])
        expect(r.elementsByMode.fdsGen).toEqual(r.elements)
        expect(r.elementsByMode.radiation).toEqual([])
    })
})

describe('registry wiring', () => {
    it('registers fdsGen handlers on the registry', () => {
        expect(MODE_PERSISTENCE.fdsGen.buildPayload).toBe(buildFdsPayload)
        expect(MODE_PERSISTENCE.fdsGen.hydrate).toBe(hydrateFdsState)
    })

    it('non-DB modes have no handlers yet', () => {
        expect(MODE_PERSISTENCE.radiation.buildPayload).toBeUndefined()
        expect(MODE_PERSISTENCE.timeEq.hydrate).toBeUndefined()
    })
})
