// Keep stored geometry in PDF pixels, independent of display zoom and scrolling.
export function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect()
    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height,
    }
}

/** Alignment magnet in screen pixels. Convert with canvasSnapThreshold. */
export const SNAP_SCREEN_PX = 15

/**
 * Convert a screen-pixel hit/snap radius into canvas/PDF pixels.
 * CSS zoom draws the canvas at `canvasWidth * zoom`, and canvasPoint maps
 * the pointer back with canvasPx = screenPx / zoom. A constant canvas-pixel
 * threshold therefore shrinks on screen when zoomed out.
 *
 * Same pattern as EFS bay hit (`10 / zoom`).
 */
export function canvasSnapThreshold(screenPx, zoom) {
    const z = Number(zoom)
    if (!(z > 0) || !Number.isFinite(z)) return screenPx
    return screenPx / z
}

export function canvasClientPoint(point, canvas) {
    if (!canvas) return point
    const rect = canvas.getBoundingClientRect()
    return {
        x: rect.left + point.x * rect.width / canvas.width,
        y: rect.top + point.y * rect.height / canvas.height,
    }
}
