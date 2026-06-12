// Scale calibration in PDF-intrinsic units (issue #15).
//
// Every serious measurement tool (Bluebeam, Acrobat, PDF-XChange) anchors scale
// to the document's intrinsic units — PDF points (1/72") at render-scale 1.0 —
// never to render/screen pixels. That's what makes a calibration survive a
// change of DPI, zoom, or device. We do the same: the persisted source of truth
// is `pagePointsPerMesh` (PDF points per 0.1 m at render-scale 1.0), plus the
// two calibration points (in page points) and the entered length. The render
// pixel value `pixelsPerMesh` is always DERIVED on demand from
// `pagePointsPerMesh × currentRenderScale`.

import { calcDistance } from './helperFunctions'

// A mesh cell is 0.1 m — the FDS grid unit the canvas snaps to. `pixelsPerMesh`
// and `pagePointsPerMesh` are both "per 0.1 m".
export const MESH_METERS = 0.1

// The hard-coded render scale used by renderPdf (pages/index.jsx). A PDF page
// rendered at this scale is `scale ×` its intrinsic page-point size. Kept here
// so the store default, the renderer, and the derive math share one number.
export const DEFAULT_RENDER_SCALE = 1.5

// A render-pixel point -> intrinsic PDF page point.
function pixelToPagePoint(pt, renderScale) {
    return { x: pt.x / renderScale, y: pt.y / renderScale }
}

// An intrinsic PDF page point -> render pixels at the current render scale.
// Used to redraw the stored calibration line on the canvas (issue #19).
export function pagePointToPixel(pt, renderScale) {
    return { x: pt.x * renderScale, y: pt.y * renderScale }
}

// Build an intrinsic calibration from a line measured in render pixels.
// `p1`/`p2` are canvas-intrinsic (render-pixel) points; `lengthMeters` is the
// known real-world distance the user entered. The result is render-independent.
export function buildCalibration(p1, p2, lengthMeters, renderScale) {
    const points = [pixelToPagePoint(p1, renderScale), pixelToPagePoint(p2, renderScale)]
    const pagePointsDist = calcDistance(points[0], points[1])
    const pagePointsPerMesh = (pagePointsDist * MESH_METERS) / lengthMeters
    return { pagePointsPerMesh, points, lengthMeters }
}

// Recompute the scale from an EXISTING stored calibration line and a new entered
// length — the "Change length" path (issue #19), no re-clicking. The line is
// preserved; only the ratio and the recorded length change.
export function recalibrateLength(calibration, lengthMeters) {
    const pagePointsDist = calcDistance(calibration.points[0], calibration.points[1])
    const pagePointsPerMesh = (pagePointsDist * MESH_METERS) / lengthMeters
    return { ...calibration, pagePointsPerMesh, lengthMeters }
}

// The render-pixel scale derived from the intrinsic calibration at the current
// render scale. Returns the unset sentinel (1) when there is no real
// calibration, matching `hasScale = pixelsPerMesh !== 1`.
export function derivePixelsPerMesh(calibration, renderScale) {
    if (!calibration || !calibration.pagePointsPerMesh) return 1
    return calibration.pagePointsPerMesh * renderScale
}

// Back-compat (issue #15): a project saved before intrinsic storage has only the
// old `pixels_per_mesh` (render px per mesh at the legacy render scale).
// Reconstruct an intrinsic calibration so the derive path reproduces the exact
// same number. There's no stored line, so "Change length" isn't offered until
// the user re-measures.
export function calibrationFromLegacyPixels(pixelsPerMesh, renderScale) {
    if (!pixelsPerMesh || pixelsPerMesh === 1) return null
    return {
        pagePointsPerMesh: pixelsPerMesh / renderScale,
        points: null,
        lengthMeters: null,
    }
}

// Human-readable scale for the re-entry panel (issue #19): "1.00 m = N px".
// pixelsPerMesh is px per 0.1 m, so one metre is 10× that.
export function formatScale(pixelsPerMesh) {
    const pxPerMeter = pixelsPerMesh * 10
    return `1.00 m = ${pxPerMeter.toFixed(0)} px`
}
