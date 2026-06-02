// Per-mode persistence registry.
//
// Single source of truth for "is this mode backed by the projects DB?". Modes
// are brought onto the DB incrementally — today only fdsGen persists; radiation
// and timeEq compute in-memory. Bringing a mode onto the DB later should be an
// additive change here (flip `dbBacked`, and in Phase 3 attach buildPayload /
// hydrate), never a scattered edit of hardcoded `currentMode === 'fdsGen'`
// checks across the app.

export const MODE_PERSISTENCE = {
    fdsGen: { dbBacked: true },
    radiation: { dbBacked: false },
    timeEq: { dbBacked: false },
}

// True only when the given mode should read/write the projects DB (dashboard,
// project creation, PDF upload, debounced auto-save).
export const isDbBacked = (mode) => Boolean(MODE_PERSISTENCE[mode]?.dbBacked)

// --- localStorage persistence versioning ---
//
// Bump PERSIST_VERSION whenever the persisted shape changes and add a branch to
// migratePersistedState so returning users' stored blobs upgrade cleanly.
//
// v0 -> v1: project persistence (projectId/floorId/projectName) was added. Older
// blobs predate it, so ensure those keys exist rather than leaving them
// undefined (which could arm auto-save against an undefined project).
// v1 -> v2: geometry split into per-mode buckets (elementsByMode). The old flat
// `elements` array belonged to fdsGen, so seed the fdsGen bucket from it.
export const PERSIST_VERSION = 2

export function migratePersistedState(persisted, fromVersion) {
    if (!persisted) return persisted
    let state = persisted

    if (fromVersion < 1) {
        state = {
            ...state,
            projectId: state.projectId ?? null,
            floorId: state.floorId ?? null,
            projectName: state.projectName ?? null,
        }
    }

    if (fromVersion < 2) {
        state = {
            ...state,
            elementsByMode: state.elementsByMode ?? {
                fdsGen: state.elements ?? [],
                radiation: [],
                timeEq: [],
            },
        }
    }

    return state
}

// Custom persist merge. Replicates Zustand's default shallow merge, then
// reconstructs the live `elements` array from the booted mode's bucket.
// `currentMode` is intentionally not persisted, so on reload it is the default
// ('fdsGen'); the persisted live `elements` may be left over from whatever mode
// was active at save time, so the per-mode bucket is the source of truth.
export function mergePersistedState(persisted, current) {
    const merged = { ...current, ...(persisted || {}) }
    const mode = merged.currentMode
    if (merged.elementsByMode && merged.elementsByMode[mode]) {
        merged.elements = merged.elementsByMode[mode]
    }
    return merged
}
