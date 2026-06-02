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
export const PERSIST_VERSION = 1

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

    return state
}
