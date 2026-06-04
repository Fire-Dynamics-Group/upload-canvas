import { buildFdsPayload, hydrateFdsState } from './fdsPersistence'

// Per-mode persistence registry.
//
// Single source of truth for "is this mode backed by the projects DB?", plus
// the per-mode save/hydrate handlers. Modes are brought onto the DB
// incrementally — today only fdsGen persists; radiation and timeEq compute
// in-memory. Bringing a mode onto the DB later is an additive change here:
// write its handlers, add an entry with `dbBacked: true`. No scattered edits of
// hardcoded `currentMode === 'fdsGen'` checks across the app.
//
// Handler contract:
//   buildPayload(state) -> payload for saveProjectToServer
//   hydrate(project, floorDetail, state) -> partial store state to `set`

export const MODE_PERSISTENCE = {
    fdsGen: { dbBacked: true, buildPayload: buildFdsPayload, hydrate: hydrateFdsState },
    radiation: { dbBacked: false },
    timeEq: { dbBacked: false },
    efs: { dbBacked: false },
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
                efs: [],
            },
        }
    }

    return state
}

// Fields that only mean something for a DB-backed session: the live geometry
// checkout, the scale calibration, and the active tool. For a non-DB mode
// (radiation/timeEq) these are scratch — caching them would resurrect a stale
// drawing on reload and, because `tool` is among them, skip the scale step on
// the next upload. They are written to localStorage only while the active mode
// is DB-backed.
const DB_BACKED_ONLY_FIELDS = [
    'elements',
    'tool',
    'pixelsPerMesh',
    'canvasDimensions',
    'convertedPoints',
    'originPixels',
    'hasDoor',
]

// localStorage partializer (the `partialize` option of zustand/persist).
// Project meta + global settings are always cached; per-mode geometry buckets
// are filtered to DB-backed modes only; the live scratch fields above are
// cached only when the active mode is DB-backed. Net effect: a radiation/timeEq
// session leaves nothing behind to restore on reload.
export function partializeState(state) {
    const persisted = {
        projectId: state.projectId,
        floorId: state.floorId,
        projectName: state.projectName,
        // Only DB-backed buckets survive; radiation/timeEq never persist.
        elementsByMode: Object.fromEntries(
            Object.entries(state.elementsByMode || {}).filter(([mode]) => isDbBacked(mode))
        ),
        comment: state.comment,
        totalHeatFlux: state.totalHeatFlux,
        heatEndpoint: state.heatEndpoint,
        fireHRR: state.fireHRR,
        fireDimension: state.fireDimension,
        fireHeightAboveFloor: state.fireHeightAboveFloor,
        fireBase: state.fireBase,
        fireType: state.fireType,
        fireGrowthRate: state.fireGrowthRate,
        fireCustomAlpha: state.fireCustomAlpha,
        fireFloorZ: state.fireFloorZ,
        fireFloorNumber: state.fireFloorNumber,
        totalFloors: state.totalFloors,
        wallHeight: state.wallHeight,
        stairRoofZ: state.stairRoofZ,
        topStoreyHeight: state.topStoreyHeight,
        numberOfStairs: state.numberOfStairs,
        stairObject: state.stairObject,
        commonCorridorMode: state.commonCorridorMode,
        scenarioType: state.scenarioType,
        simEndTime: state.simEndTime,
        includeSensors: state.includeSensors,
        corridorSensorHeights: state.corridorSensorHeights,
        stairSensorHeights: state.stairSensorHeights,
        fsaSensorHeights: state.fsaSensorHeights,
        isSprinklered: state.isSprinklered,
        doorRoles: state.doorRoles,
        doorLeakagesEnabled: state.doorLeakagesEnabled,
        doorLeakageConfig: state.doorLeakageConfig,
        doorOpenings: state.doorOpenings,
        landingRoles: state.landingRoles,
        landingUpSide: state.landingUpSide,
        stairStyle: state.stairStyle,
        extractConfig: state.extractConfig,
        inletConfig: state.inletConfig,
        zoneConfig: state.zoneConfig,
        sliceZHeight: state.sliceZHeight,
        aovMode: state.aovMode,
        aovActivationTime: state.aovActivationTime,
        obstructionTransparency: state.obstructionTransparency,
    }

    if (isDbBacked(state.currentMode)) {
        for (const field of DB_BACKED_ONLY_FIELDS) {
            persisted[field] = state[field]
        }
    }

    return persisted
}

// Custom persist merge. Replicates Zustand's default shallow merge, then
// reconstructs the live `elements` array from the booted mode's bucket.
// `currentMode` is intentionally not persisted, so on reload it is the default
// ('fdsGen'); the persisted live `elements` may be left over from whatever mode
// was active at save time, so the per-mode bucket is the source of truth.
//
// partializeState drops the non-DB buckets, so re-seed any missing modes back
// to empty arrays — the store invariant is that elementsByMode has a bucket per
// known mode.
export function mergePersistedState(persisted, current) {
    const merged = { ...current, ...(persisted || {}) }
    merged.elementsByMode = {
        ...(current?.elementsByMode || {}),
        ...(persisted?.elementsByMode || {}),
    }
    const mode = merged.currentMode
    if (merged.elementsByMode[mode]) {
        merged.elements = merged.elementsByMode[mode]
    }
    return merged
}
