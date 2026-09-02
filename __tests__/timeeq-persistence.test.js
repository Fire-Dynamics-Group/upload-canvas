import { describe, it, expect } from 'vitest'
import {
    TIME_EQ_INPUT_DEFAULTS,
    resolveTimeEqInputs,
    buildTimeEqPayload,
    hydrateTimeEqState,
    timeEqAutosaveSnapshot,
} from '../store/timeEqPersistence'
import { MODE_PERSISTENCE, autosaveSnapshot } from '../store/persistenceModes'
import { RELIABILITY_DEFAULTS } from '../utils/teqReliabilityConstants'

// timeEq is the second mode onboarded onto the projects DB. Its handlers are
// pure functions on the registry, like fdsGen's. The compartment inputs that
// used to live only in the popup's local state are now a store slice
// (timeEqInputs) so they round-trip through project.settings.

const geometry = { wallCount: 4, openingCount: 2, wallLengths: [10, 5.123456, 10, 5.123456] }

describe('resolveTimeEqInputs — merge saved inputs over geometry-derived defaults', () => {
    it('returns full defaults when nothing was saved', () => {
        const r = resolveTimeEqInputs(null, geometry)
        expect(r.fireResistancePeriod).toBe(TIME_EQ_INPUT_DEFAULTS.fireResistancePeriod)
        expect(r.nSim).toBe(RELIABILITY_DEFAULTS.nSim)
        expect(r.wallProperties).toEqual(['concrete', 'concrete', 'concrete', 'concrete'])
        expect(r.openingHeights).toEqual([1, 1])
        expect(r.floorAndCeilingMaterials).toEqual(['concrete', 'concrete'])
        // openable widths default to the drawn wall lengths, rounded to 2dp
        expect(r.openableWidths).toEqual([10, 5.12, 10, 5.12])
    })

    it('keeps saved scalar inputs', () => {
        const r = resolveTimeEqInputs(
            { fireResistancePeriod: 60, isSprinklered: true, use: 'Hotel', calcType: 'reliability', mcOccupancy: 'Library' },
            geometry,
        )
        expect(r.fireResistancePeriod).toBe(60)
        expect(r.isSprinklered).toBe(true)
        expect(r.use).toBe('Hotel')
        expect(r.calcType).toBe('reliability')
        expect(r.mcOccupancy).toBe('Library')
    })

    it('keeps saved per-wall / per-opening arrays when they still fit the drawing', () => {
        const r = resolveTimeEqInputs(
            {
                wallProperties: ['brick', 'brick', 'plasterboard', 'concrete'],
                openingHeights: [1.5, 2],
                openableWidths: [10, 0, 10, 0],
            },
            geometry,
        )
        expect(r.wallProperties).toEqual(['brick', 'brick', 'plasterboard', 'concrete'])
        expect(r.openingHeights).toEqual([1.5, 2])
        expect(r.openableWidths).toEqual([10, 0, 10, 0])
    })

    it('falls back to geometry defaults when a saved array no longer matches the drawing', () => {
        // The user redrew the compartment with a different number of walls /
        // openings after saving — stale per-index values must not be applied.
        const r = resolveTimeEqInputs(
            { wallProperties: ['brick', 'brick'], openingHeights: [1.5], openableWidths: [1, 2, 3] },
            geometry,
        )
        expect(r.wallProperties).toEqual(['concrete', 'concrete', 'concrete', 'concrete'])
        expect(r.openingHeights).toEqual([1, 1])
        expect(r.openableWidths).toEqual([10, 5.12, 10, 5.12])
    })

    it('ignores unknown saved keys', () => {
        const r = resolveTimeEqInputs({ bogus: 1 }, geometry)
        expect('bogus' in r).toBe(false)
    })
})

const sampleState = {
    projectName: 'Warehouse TEQ',
    currentMode: 'timeEq',
    thumbnail: 'data:img',
    canvasDimensions: { width: 800, height: 600 },
    pixelsPerMesh: 12.5,
    originPixels: { x: 3, y: 4 },
    timeEqInputs: { fireResistancePeriod: 60, wallProperties: ['brick'] },
    timeEqResult: { reliability: 0.97, seed: 42 },
    elements: [
        { id: 0, type: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], comments: 'obstruction' },
        { id: 1, type: 'line', points: [{ x: 10, y: 0 }, { x: 10, y: 5 }], comments: 'opening' },
    ],
    elementsByMode: { fdsGen: [{ id: 9 }], radiation: [], timeEq: [], efs: [] },
}

describe('buildTimeEqPayload', () => {
    it('maps the store into the project/floor save payload', () => {
        const p = buildTimeEqPayload(sampleState)
        expect(p.name).toBe('Warehouse TEQ')
        expect(p.settings.timeEqInputs).toEqual({ fireResistancePeriod: 60, wallProperties: ['brick'] })
        expect(p.settings.timeEqResult).toEqual({ reliability: 0.97, seed: 42 })
        expect(p.settings.thumbnail).toBe('data:img')
        expect(p.floors).toHaveLength(1)
        const floor = p.floors[0]
        expect(floor.floor_number).toBe(0)
        expect(floor.canvas_dimensions).toEqual({ width: 800, height: 600 })
        expect(floor.pixels_per_mesh).toBe(12.5)
        expect(floor.origin_pixels).toEqual({ x: 3, y: 4 })
        expect(floor.elements).toEqual([
            { element_index: 0, type: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], comments: 'obstruction' },
            { element_index: 1, type: 'line', points: [{ x: 10, y: 0 }, { x: 10, y: 5 }], comments: 'opening' },
        ])
    })

    it('defaults the name and tolerates a fresh store', () => {
        const p = buildTimeEqPayload({ elements: [], elementsByMode: {} })
        expect(p.name).toBe('Untitled Project')
        expect(p.settings.timeEqInputs).toEqual({})
        expect(p.settings.timeEqResult).toBe(null)
        expect(p.floors[0].elements).toEqual([])
    })
})

describe('hydrateTimeEqState', () => {
    const project = {
        id: 'p1', name: 'Loaded TEQ', mode: 'timeEq',
        settings: { timeEqInputs: { use: 'Library' }, timeEqResult: { reliability: 0.5 } },
    }
    const floorDetail = {
        id: 'f1', canvas_dimensions: { width: 1, height: 2 }, pixels_per_mesh: 3, origin_pixels: { x: 1, y: 1 },
        settings: {},
        elements: [{ id: 'uuid', element_index: 4, type: 'line', points: [{ x: 0, y: 0 }], comments: 'opening' }],
    }

    it('restores project meta, inputs, result, scale and geometry into the timeEq bucket', () => {
        const next = hydrateTimeEqState(project, floorDetail, sampleState)
        expect(next.projectId).toBe('p1')
        expect(next.projectName).toBe('Loaded TEQ')
        expect(next.floorId).toBe('f1')
        expect(next.timeEqInputs).toEqual({ use: 'Library' })
        expect(next.timeEqResult).toEqual({ reliability: 0.5 })
        expect(next.pixelsPerMesh).toBe(3)
        expect(next.canvasDimensions).toEqual({ width: 1, height: 2 })
        expect(next.originPixels).toEqual({ x: 1, y: 1 })
        expect(next.elements).toEqual([{ id: 4, type: 'line', points: [{ x: 0, y: 0 }], comments: 'opening' }])
        expect(next.elementsByMode.timeEq).toEqual(next.elements)
        // other buckets untouched
        expect(next.elementsByMode.fdsGen).toEqual([{ id: 9 }])
    })

    it('round-trips through buildTimeEqPayload', () => {
        const hydrated = { ...sampleState, ...hydrateTimeEqState(project, floorDetail, sampleState) }
        const again = buildTimeEqPayload(hydrated)
        expect(again.settings.timeEqInputs).toEqual({ use: 'Library' })
        expect(again.floors[0].elements).toEqual([
            { element_index: 4, type: 'line', points: [{ x: 0, y: 0 }], comments: 'opening' },
        ])
    })

    it('tolerates a project with empty settings', () => {
        const next = hydrateTimeEqState({ id: 'p', name: 'N', settings: {} }, { id: 'f', elements: [] }, sampleState)
        expect(next.timeEqInputs).toEqual({})
        expect(next.timeEqResult).toBe(null)
        expect(next.elements).toEqual([])
    })
})

describe('registry wiring', () => {
    it('registers timeEq as DB-backed with both handlers', () => {
        expect(MODE_PERSISTENCE.timeEq.dbBacked).toBe(true)
        expect(MODE_PERSISTENCE.timeEq.buildPayload).toBe(buildTimeEqPayload)
        expect(MODE_PERSISTENCE.timeEq.hydrate).toBe(hydrateTimeEqState)
    })

    it('autosave change-detection snapshot covers the timeEq inputs and result', () => {
        const snap = autosaveSnapshot(sampleState)
        expect(snap).toEqual(timeEqAutosaveSnapshot(sampleState))
        expect(snap.timeEqInputs).toEqual(sampleState.timeEqInputs)
        expect(snap.timeEqResult).toEqual(sampleState.timeEqResult)
        expect(snap.elements).toEqual(sampleState.elements)
        expect(snap.pixelsPerMesh).toBe(12.5)
    })

    it('fdsGen has a snapshot too; non-DB modes have none', () => {
        expect(autosaveSnapshot({ ...sampleState, currentMode: 'fdsGen' })).not.toBeNull()
        expect(autosaveSnapshot({ ...sampleState, currentMode: 'radiation' })).toBeNull()
        expect(autosaveSnapshot({ ...sampleState, currentMode: 'efs' })).toBeNull()
    })
})
