import { RELIABILITY_DEFAULTS } from '../utils/teqReliabilityConstants'

// Per-mode persistence handlers for timeEq — pure functions registered on the
// MODE_PERSISTENCE registry (see persistenceModes.js), mirroring fdsPersistence.
//
// A time-equivalence project is one compartment drawn on one plan: the
// obstruction polygon + opening lines (floor 0 elements), the scale
// calibration (floor 0 canvas/scale fields), the popup inputs (project
// settings.timeEqInputs) and the last Monte Carlo result (settings.timeEqResult)
// so a reopened project shows what the engineer last ran.

// Scalar popup inputs and their defaults. The per-geometry arrays
// (wallProperties / openingHeights / openableWidths) are sized from the drawing
// in resolveTimeEqInputs rather than defaulted here.
export const TIME_EQ_INPUT_DEFAULTS = {
    calcType: 'deterministic',          // 'deterministic' | 'reliability'
    fireResistancePeriod: 90,
    compartmentHeight: 3.15,
    isSprinklered: false,
    use: 'Office',                      // deterministic occupancy (useObject)
    floorAndCeilingMaterials: ['concrete', 'concrete'],
    // Monte Carlo reliability inputs
    mcOccupancy: 'Office',
    nSim: RELIABILITY_DEFAULTS.nSim,
    growthRate: RELIABILITY_DEFAULTS.growthRate,
    combustionFactor: RELIABILITY_DEFAULTS.combustionFactor,
    sprinklerFactor: RELIABILITY_DEFAULTS.sprinklerFactor,
    sectionFactor: RELIABILITY_DEFAULTS.sectionFactor,
    criticalTemp: RELIABILITY_DEFAULTS.criticalTemp,
    customBValue: '',                   // blank => derive from materials
    memberProtection: 'protected',      // 'protected' | 'unprotected'
}

const sized = (candidate, length, fill) =>
    Array.isArray(candidate) && candidate.length === length
        ? candidate
        : Array.from({ length }, (_, i) => (typeof fill === 'function' ? fill(i) : fill))

// Merge saved inputs over the defaults for the *current* drawing. Per-wall /
// per-opening arrays are only kept when they still fit the geometry; if the
// user redrew the compartment since saving, stale per-index values would be
// silently applied to the wrong walls, so they fall back to defaults instead.
export function resolveTimeEqInputs(saved, { wallCount = 0, openingCount = 0, wallLengths = [] } = {}) {
    const s = saved || {}
    const resolved = { ...TIME_EQ_INPUT_DEFAULTS }
    for (const key of Object.keys(TIME_EQ_INPUT_DEFAULTS)) {
        if (s[key] !== undefined) resolved[key] = s[key]
    }
    resolved.floorAndCeilingMaterials = sized(resolved.floorAndCeilingMaterials, 2, 'concrete')
    resolved.wallProperties = sized(s.wallProperties, wallCount, 'concrete')
    resolved.openingHeights = sized(s.openingHeights, openingCount, 1)
    resolved.openableWidths = sized(
        s.openableWidths,
        wallLengths.length,
        (i) => Number(wallLengths[i].toFixed(2)),
    )
    return resolved
}

const toElementIn = (el, i) => ({
    element_index: el.id ?? i,
    type: el.type,
    points: el.points,
    comments: el.comments,
})

const fromElementOut = (el) => ({
    id: el.element_index,
    type: el.type,
    points: el.points,
    comments: el.comments,
})

// Build the bulk-save payload for the projects API from store state.
export function buildTimeEqPayload(s) {
    return {
        name: s.projectName || 'Untitled Project',
        settings: {
            timeEqInputs: s.timeEqInputs || {},
            timeEqResult: s.timeEqResult ?? null,
            thumbnail: s.thumbnail ?? null,
        },
        floors: [
            {
                floor_number: 0,
                name: 'Compartment',
                canvas_dimensions: s.canvasDimensions,
                pixels_per_mesh: s.pixelsPerMesh,
                origin_pixels: s.originPixels,
                settings: {},
                elements: (s.elements || []).map(toElementIn),
            },
        ],
    }
}

// Reconstruct the partial store state from a loaded project + floor detail.
// `state` is the current store state (for the per-mode geometry bucket spread).
export function hydrateTimeEqState(project, floorDetail, state) {
    const ps = project.settings || {}
    const loadedElements = (floorDetail.elements || []).map(fromElementOut)
    return {
        projectId: project.id,
        projectName: project.name,
        floorId: floorDetail.id,
        timeEqInputs: ps.timeEqInputs ?? {},
        timeEqResult: ps.timeEqResult ?? null,
        canvasDimensions: floorDetail.canvas_dimensions || {},
        pixelsPerMesh: floorDetail.pixels_per_mesh || 1,
        originPixels: floorDetail.origin_pixels || null,
        elements: loadedElements,
        elementsByMode: { ...state.elementsByMode, [state.currentMode]: loadedElements },
    }
}

// The subset of state whose change should arm the debounced autosave.
export function timeEqAutosaveSnapshot(s) {
    return {
        elements: s.elements,
        pixelsPerMesh: s.pixelsPerMesh,
        canvasDimensions: s.canvasDimensions,
        originPixels: s.originPixels,
        timeEqInputs: s.timeEqInputs,
        timeEqResult: s.timeEqResult,
    }
}
