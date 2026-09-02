import { describe, it, expect } from 'vitest'
import { partializeState, mergePersistedState } from '../store/persistenceModes'

// What localStorage is allowed to keep. Non-DB modes (radiation/efs) are
// scratch: nothing they produce — geometry, scale calibration, active tool —
// may survive a reload. Only DB-backed work (fdsGen/timeEq) is cached. See
// persistenceModes.js and [[autosave-mode-guard]].
const baseState = (overrides = {}) => ({
    projectId: 'p1',
    floorId: 'f1',
    projectName: 'Tower',
    currentMode: 'fdsGen',
    elements: [{ id: 1, comments: 'mesh' }],
    elementsByMode: {
        fdsGen: [{ id: 1, comments: 'mesh' }],
        radiation: [{ id: 9, comments: 'escapeRoute' }],
        timeEq: [{ id: 5, comments: 'wall' }],
    },
    tool: 'obstruction',
    pixelsPerMesh: 4,
    canvasDimensions: { width: 100, height: 200 },
    convertedPoints: [{ x: 1, y: 2 }],
    originPixels: { x: 0, y: 0 },
    hasDoor: true,
    // a global, mode-agnostic setting — always cached
    fireHRR: 1000,
    ...overrides,
})

describe('partializeState — non-DB modes are ephemeral', () => {
    it('caches live geometry/scale/tool when the active mode is DB-backed', () => {
        const p = partializeState(baseState({ currentMode: 'fdsGen' }))
        expect(p.elements).toEqual([{ id: 1, comments: 'mesh' }])
        expect(p.tool).toBe('obstruction')
        expect(p.pixelsPerMesh).toBe(4)
        expect(p.canvasDimensions).toEqual({ width: 100, height: 200 })
        expect(p.convertedPoints).toEqual([{ x: 1, y: 2 }])
        expect(p.originPixels).toEqual({ x: 0, y: 0 })
        expect(p.hasDoor).toBe(true)
    })

    it('omits live geometry/scale/tool when the active mode is NOT DB-backed', () => {
        const p = partializeState(baseState({ currentMode: 'radiation' }))
        // these would otherwise restore a scratch session on reload
        expect('elements' in p).toBe(false)
        expect('tool' in p).toBe(false)
        expect('pixelsPerMesh' in p).toBe(false)
        expect('canvasDimensions' in p).toBe(false)
        expect('convertedPoints' in p).toBe(false)
        expect('originPixels' in p).toBe(false)
        expect('hasDoor' in p).toBe(false)
    })

    it('never caches non-DB-backed geometry buckets, in any mode', () => {
        for (const mode of ['fdsGen', 'radiation', 'timeEq']) {
            const p = partializeState(baseState({ currentMode: mode }))
            expect(Object.keys(p.elementsByMode).sort()).toEqual(['fdsGen', 'timeEq'])
            expect(p.elementsByMode.fdsGen).toEqual([{ id: 1, comments: 'mesh' }])
            expect(p.elementsByMode.timeEq).toEqual([{ id: 5, comments: 'wall' }])
        }
    })

    it('caches the timeEq inputs/result and records which mode the project belongs to', () => {
        const p = partializeState(baseState({
            currentMode: 'timeEq',
            timeEqInputs: { use: 'Hotel' },
            timeEqResult: { reliability: 0.9 },
        }))
        expect(p.projectMode).toBe('timeEq')
        expect(p.timeEqInputs).toEqual({ use: 'Hotel' })
        expect(p.timeEqResult).toEqual({ reliability: 0.9 })
    })

    it('still caches project meta and global settings in any mode', () => {
        const p = partializeState(baseState({ currentMode: 'radiation' }))
        expect(p.projectId).toBe('p1')
        expect(p.floorId).toBe('f1')
        expect(p.projectName).toBe('Tower')
        expect(p.fireHRR).toBe(1000)
    })
})

describe('mergePersistedState — a cached project only re-attaches to its own mode', () => {
    // currentMode is not persisted, so a reload always boots into fdsGen. If
    // the cached projectId belongs to a timeEq project, re-attaching it to
    // fdsGen would let the first autosave write fdsGen geometry onto it.
    it('drops the cached project when it belongs to a different mode', () => {
        const merged = mergePersistedState(
            { projectId: 'teq-1', floorId: 'f1', projectName: 'TEQ', projectMode: 'timeEq' },
            { currentMode: 'fdsGen', projectId: null, floorId: null, projectName: null, elements: [] }
        )
        expect(merged.projectId).toBe(null)
        expect(merged.floorId).toBe(null)
        expect(merged.projectName).toBe(null)
    })

    it('keeps the cached project when the mode matches', () => {
        const merged = mergePersistedState(
            { projectId: 'fds-1', floorId: 'f1', projectName: 'Tower', projectMode: 'fdsGen' },
            { currentMode: 'fdsGen', projectId: null, elements: [] }
        )
        expect(merged.projectId).toBe('fds-1')
        expect(merged.projectName).toBe('Tower')
    })

    it('keeps a legacy blob with no projectMode (pre-dates per-mode projects)', () => {
        const merged = mergePersistedState(
            { projectId: 'fds-1', floorId: 'f1', projectName: 'Tower' },
            { currentMode: 'fdsGen', projectId: null, elements: [] }
        )
        expect(merged.projectId).toBe('fds-1')
    })
})

describe('mergePersistedState — re-seeds buckets dropped by partialize', () => {
    it('restores empty radiation/timeEq buckets when the blob only cached fdsGen', () => {
        const merged = mergePersistedState(
            { elementsByMode: { fdsGen: [{ id: 1 }] } },
            {
                currentMode: 'fdsGen',
                elements: [],
                elementsByMode: { fdsGen: [], radiation: [], timeEq: [] },
            }
        )
        expect(merged.elementsByMode).toEqual({
            fdsGen: [{ id: 1 }],
            radiation: [],
            timeEq: [],
        })
        expect(merged.elements).toEqual([{ id: 1 }])
    })
})
