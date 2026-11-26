// Per-mode persistence handlers for efs — pure functions registered on the
// MODE_PERSISTENCE registry (see persistenceModes.js), mirroring timeEqPersistence.
//
// An External Fire Spread (EFS) project is a site plan / building outline drawn
// on one plan: the wall, boundary, and region polylines (floor 0 elements),
// the scale calibration (floor 0 canvas/scale fields), and the EFS inputs,
// per-elevation protection/end-spacing/region config, and report-display
// options (project settings.efsSettings).

export const EFS_SETTINGS_DEFAULTS = {
    efsColumnSpacing: 8,
    efsHeight: 18,
    efsFireTempC: 1040,
    efsSprinklered: false,
    efsCornersFirst: true,
    efsActiveElevation: 0,
    efsProtectedByElev: {},
    efsRequiredByElev: {},
    efsEndSpacingByElev: {},
    efsRegionConfig: {},
    efsCalcDone: false,
    efsShowScaleGrid: true,
    efsShowDistanceArrows: true,
    efsShowDistances: true,
    efsShowGridSquares: true,
    efsShowGridNumbers: true,
    efsShowBayLabels: true,
    efsWallLineWidth: 6,
    efsBoundaryLineWidth: 4,
    efsNeededBoundaryLineWidth: 4,
    efsArrowLineWidth: 1.5,
    efsRadiationFillOpacity: 0.1,
    efsScreenshotMode: false,
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

const pickEfsSettings = (source) => {
    const out = {}
    for (const [key, fallback] of Object.entries(EFS_SETTINGS_DEFAULTS)) {
        out[key] = source?.[key] !== undefined ? source[key] : fallback
    }
    return out
}

// Build the bulk-save payload for the projects API from store state.
export function buildEfsPayload(s) {
    return {
        name: s.projectName || 'Untitled Project',
        settings: {
            efsSettings: pickEfsSettings(s),
            thumbnail: s.thumbnail ?? null,
        },
        floors: [
            {
                floor_number: 0,
                name: 'Site Plan',
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
export function hydrateEfsState(project, floorDetail, state) {
    const ps = project.settings || {}
    const loadedElements = (floorDetail.elements || []).map(fromElementOut)
    return {
        projectId: project.id,
        projectName: project.name,
        floorId: floorDetail.id,
        ...pickEfsSettings(ps.efsSettings),
        canvasDimensions: floorDetail.canvas_dimensions || {},
        pixelsPerMesh: floorDetail.pixels_per_mesh || 1,
        originPixels: floorDetail.origin_pixels || null,
        elements: loadedElements,
        elementsByMode: { ...state.elementsByMode, [state.currentMode]: loadedElements },
    }
}

// The subset of state whose change should arm the debounced autosave.
export function efsAutosaveSnapshot(s) {
    return {
        elements: s.elements,
        pixelsPerMesh: s.pixelsPerMesh,
        canvasDimensions: s.canvasDimensions,
        originPixels: s.originPixels,
        ...pickEfsSettings(s),
    }
}
