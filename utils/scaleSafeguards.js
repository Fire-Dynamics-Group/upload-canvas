// Safeguards against silent scale loss (issue #18).
//
// The grid is gated on `hasScale = pixelsPerMesh !== 1`, so a project whose
// scale silently reverts to the unset sentinel (1) shows no grid and exports
// mis-scaled FDS. Two pure guards close the two ways that happens:
//   1. autosave clobbering a real saved scale with an in-memory 1, and
//   2. loading a project whose scale is unset while it already has elements.

// The "unset" scale sentinel: pixelsPerMesh defaults to 1 before calibration.
const UNSET_SCALE = 1

// True when a save payload would overwrite a real scale with the unset sentinel
// on a floor that already has elements — almost always a transient in-memory
// blank, never a legitimate edit (you can't draw elements before scaling). The
// caller skips the save so the good DB value survives. A genuinely empty floor
// (no elements) is unaffected.
export function wouldClobberScale(payload) {
    const floors = payload?.floors
    if (!Array.isArray(floors) || floors.length === 0) return false
    return floors.some(
        (f) => f?.pixels_per_mesh === UNSET_SCALE && (f?.elements?.length ?? 0) > 0
    )
}

// True when a freshly loaded floor has elements but no scale — the user should
// be told to set the scale (grid won't show, export would be mis-scaled) rather
// than silently shown an empty grid.
export function shouldPromptForScale({ pixelsPerMesh, elementsCount }) {
    return pixelsPerMesh === UNSET_SCALE && (elementsCount ?? 0) > 0
}
