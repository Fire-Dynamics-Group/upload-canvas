/**
 * Auto-place sprinklers at 1.375m diagonal from fire,
 * inside enclosing polygon with 1m wall clearance (BS 9251).
 *
 * Works in pixel coordinates — same space as canvas elements.
 *
 * @param {Array} elements - All canvas elements
 * @param {number} pixelsPerMesh - Store value (mesh cell px size)
 * @returns {Array<{x: number, y: number}>} Up to 2 sprinkler positions in px coords
 */
/**
 * Whether auto-placed sprinkler markers should be drawn.
 *
 * Only in FDS generation mode (not radiation / time-equivalence), only when
 * the building is marked sprinklered, and only when the user hasn't already
 * placed manual sprinklers.
 *
 * @param {string} currentMode - Active app mode ('fdsGen' | 'radiation' | 'timeEq')
 * @param {boolean} isSprinklered - Store flag
 * @param {Array} elements - All canvas elements
 * @returns {boolean}
 */
export function shouldShowAutoSprinklers(currentMode, isSprinklered, elements = []) {
    return (
        currentMode === 'fdsGen' &&
        !!isSprinklered &&
        elements.filter(el => el.comments === 'sprinkler').length === 0
    )
}

export function computeAutoSprinklerPositions(elements, pixelsPerMesh) {
    const manualSprinklers = elements.filter(el => el.comments === 'sprinkler')
    if (manualSprinklers.length > 0) return []

    const fireEl = elements.find(el => el.comments === 'fire')
    if (!fireEl || !fireEl.points || fireEl.points.length === 0) return []

    const firePt = fireEl.points[0]
    const pxPerM = pixelsPerMesh * 10
    const offsetPx = 1.375 * pxPerM

    const pointInPoly = (px, py, poly) => {
        let inside = false
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y
            const xj = poly[j].x, yj = poly[j].y
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside
            }
        }
        return inside
    }

    const obstructions = elements.filter(el => el.comments === 'obstruction')
    let enclosingPoly = null
    for (const obs of obstructions) {
        if (pointInPoly(firePt.x, firePt.y, obs.points)) {
            enclosingPoly = obs.points
            break
        }
    }

    const minDistToPoly = (px, py, poly) => {
        let minDist = Infinity
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i], p2 = poly[(i + 1) % poly.length]
            const dx = p2.x - p1.x, dy = p2.y - p1.y
            const segLenSq = dx * dx + dy * dy
            if (segLenSq === 0) {
                minDist = Math.min(minDist, Math.hypot(px - p1.x, py - p1.y))
            } else {
                const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / segLenSq))
                minDist = Math.min(minDist, Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy)))
            }
        }
        return minDist
    }

    const minClearancePx = 1.0 * pxPerM
    const allCandidates = [
        { x: firePt.x + offsetPx, y: firePt.y + offsetPx },
        { x: firePt.x - offsetPx, y: firePt.y - offsetPx },
        { x: firePt.x + offsetPx, y: firePt.y - offsetPx },
        { x: firePt.x - offsetPx, y: firePt.y + offsetPx },
    ]

    let positions
    if (enclosingPoly) {
        positions = allCandidates.filter(c =>
            pointInPoly(c.x, c.y, enclosingPoly) &&
            minDistToPoly(c.x, c.y, enclosingPoly) >= minClearancePx
        ).slice(0, 2)
        if (positions.length < 2) {
            positions = allCandidates.filter(c => pointInPoly(c.x, c.y, enclosingPoly)).slice(0, 2)
        }
        if (positions.length < 2) positions = allCandidates.slice(0, 2)
    } else {
        positions = allCandidates.slice(0, 2)
    }

    return positions
}
