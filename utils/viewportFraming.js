// Compute the page-scroll position that frames an element in the visible area
// NOT occluded by a docked side panel — so the element being configured isn't
// hidden behind the panel.
//
// Pure on purpose: the impure wiring (read the element's box, call
// window.scrollTo) lives at the call site today, and can become a canvas
// pan/zoom later without touching this maths.
//
//   elementBox: { x, y, width, height }  document pixels (top-left + size)
//   viewport:   { width, height }
//   panel:      { side: 'left' | 'right', width } | null   (the occluded strip)
//   returns { left, top } scroll offsets, clamped to >= 0.
// Bounding box (canvas pixels) over an element's points. Returns null when the
// element has no points to frame.
export function elementPixelBox(element) {
    const points = element?.points
    if (!Array.isArray(points) || points.length === 0) return null
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

export function computeFramingScroll(elementBox, viewport, panel = null) {
    const centreX = elementBox.x + elementBox.width / 2
    const centreY = elementBox.y + elementBox.height / 2

    const panelWidth = panel?.width ?? 0
    const clearWidth = Math.max(0, viewport.width - panelWidth)
    // Centre of the clear region, in screen coordinates.
    const clearCentreX = panel?.side === 'left'
        ? panelWidth + clearWidth / 2
        : clearWidth / 2

    return {
        left: Math.max(0, centreX - clearCentreX),
        top: Math.max(0, centreY - viewport.height / 2),
    }
}
