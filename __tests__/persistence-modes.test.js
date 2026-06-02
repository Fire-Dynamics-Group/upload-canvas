import { describe, it, expect } from 'vitest'
import {
    MODE_PERSISTENCE,
    isDbBacked,
    PERSIST_VERSION,
    migratePersistedState,
} from '../store/persistenceModes'

// Phase 1: a per-mode persistence registry is the single source of truth for
// "is this mode DB-backed?". Adding a mode to the DB later must be an additive
// change (flip a flag / add an entry), never a scattered edit of `=== 'fdsGen'`.
describe('persistence mode registry', () => {
    it('registers all three current modes', () => {
        expect(Object.keys(MODE_PERSISTENCE).sort()).toEqual(
            ['fdsGen', 'radiation', 'timeEq'].sort()
        )
    })

    it('marks fdsGen as DB-backed', () => {
        expect(isDbBacked('fdsGen')).toBe(true)
    })

    it('marks radiation and timeEq as NOT DB-backed (yet)', () => {
        expect(isDbBacked('radiation')).toBe(false)
        expect(isDbBacked('timeEq')).toBe(false)
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
})
