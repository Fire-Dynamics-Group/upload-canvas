import { describe, it, expect } from 'vitest'
import {
    MODE_PERSISTENCE,
    isDbBacked,
    PERSIST_VERSION,
    migratePersistedState,
    mergePersistedState,
} from '../store/persistenceModes'

// Phase 1: a per-mode persistence registry is the single source of truth for
// "is this mode DB-backed?". Adding a mode to the DB later must be an additive
// change (flip a flag / add an entry), never a scattered edit of `=== 'fdsGen'`.
describe('persistence mode registry', () => {
    it('registers all current modes', () => {
        expect(Object.keys(MODE_PERSISTENCE).sort()).toEqual(
            ['fdsGen', 'radiation', 'timeEq', 'efs'].sort()
        )
    })

    it('marks fdsGen as DB-backed', () => {
        expect(isDbBacked('fdsGen')).toBe(true)
    })

    it('marks radiation, timeEq and efs as NOT DB-backed (yet)', () => {
        expect(isDbBacked('radiation')).toBe(false)
        expect(isDbBacked('timeEq')).toBe(false)
        expect(isDbBacked('efs')).toBe(false)
    })

    it('treats unknown/undefined modes as not DB-backed', () => {
        expect(isDbBacked('nope')).toBe(false)
        expect(isDbBacked(undefined)).toBe(false)
        expect(isDbBacked(null)).toBe(false)
    })
})

describe('persisted-state migration', () => {
    it('exposes a numeric persist version >= 1', () => {
        expect(typeof PERSIST_VERSION).toBe('number')
        expect(PERSIST_VERSION).toBeGreaterThanOrEqual(1)
    })

    it('passes through nullish persisted state unchanged', () => {
        expect(migratePersistedState(null, 0)).toBe(null)
        expect(migratePersistedState(undefined, 0)).toBe(undefined)
    })

    it('fills missing project-meta keys for pre-DB (v0) blobs', () => {
        const old = { elements: [{ id: 1 }], tool: 'scale' }
        const migrated = migratePersistedState(old, 0)
        expect(migrated.projectId).toBe(null)
        expect(migrated.floorId).toBe(null)
        expect(migrated.projectName).toBe(null)
        // existing data preserved
        expect(migrated.elements).toEqual([{ id: 1 }])
        expect(migrated.tool).toBe('scale')
    })

    it('preserves existing project-meta values when present', () => {
        const blob = { projectId: 'p1', floorId: 'f1', projectName: 'Tower' }
        const migrated = migratePersistedState(blob, 0)
        expect(migrated.projectId).toBe('p1')
        expect(migrated.floorId).toBe('f1')
        expect(migrated.projectName).toBe('Tower')
    })

    it('moves a legacy flat elements array into the fdsGen bucket (v1 -> v2)', () => {
        const blob = { elements: [{ id: 1, comments: 'mesh' }] }
        const migrated = migratePersistedState(blob, 1)
        expect(migrated.elementsByMode).toEqual({
            fdsGen: [{ id: 1, comments: 'mesh' }],
            radiation: [],
            timeEq: [],
            efs: [],
        })
        // legacy field left intact (it's the active fdsGen checkout)
        expect(migrated.elements).toEqual([{ id: 1, comments: 'mesh' }])
    })

    it('does not clobber elementsByMode for already-migrated (v2) blobs', () => {
        const blob = {
            elements: [{ id: 7 }],
            elementsByMode: { fdsGen: [{ id: 7 }], radiation: [{ id: 9 }], timeEq: [] },
        }
        const migrated = migratePersistedState(blob, 2)
        expect(migrated.elementsByMode.radiation).toEqual([{ id: 9 }])
    })
})

describe('rehydrate merge (reconstruct live elements from active bucket)', () => {
    it('shallow-merges persisted over current state', () => {
        const merged = mergePersistedState(
            { projectId: 'p1' },
            { projectId: null, currentMode: 'fdsGen', tool: 'scale' }
        )
        expect(merged.projectId).toBe('p1')
        expect(merged.tool).toBe('scale')
    })

    it('checks out the booted mode bucket, ignoring a stale persisted live array', () => {
        // currentMode is not persisted, so on reload it is the default ('fdsGen').
        // The persisted live `elements` may be left over from radiation; the
        // fdsGen bucket is the source of truth and must win.
        const merged = mergePersistedState(
            {
                elements: [{ id: 99, comments: 'escapeRoute' }], // radiation leftover
                elementsByMode: {
                    fdsGen: [{ id: 1, comments: 'mesh' }],
                    radiation: [{ id: 99, comments: 'escapeRoute' }],
                    timeEq: [],
                },
            },
            { currentMode: 'fdsGen', elements: [] }
        )
        expect(merged.elements).toEqual([{ id: 1, comments: 'mesh' }])
    })

    it('falls back gracefully when no elementsByMode is present', () => {
        const merged = mergePersistedState(
            { elements: [{ id: 5 }] },
            { currentMode: 'fdsGen', elements: [] }
        )
        expect(merged.elements).toEqual([{ id: 5 }])
    })
})
