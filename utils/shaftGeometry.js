/**
 * Compute the shaft rectangle from an extract opening line and shaft dimensions.
 *
 * The opening line is a 2-point segment on the corridor wall.
 * The shaft extends perpendicular to the opening, away from the corridor.
 *
 * To determine "away from corridor": we need the corridor centroid.
 * The shaft goes in the opposite direction from the centroid relative to the opening.
 *
 * @param {Array} openingPoints - [{x, y}, {x, y}] the 2-point opening line
 * @param {number} shaftDepth - depth of shaft perpendicular to opening (in pixels)
 * @param {Object|null} corridorCentroid - {x, y} centroid of corridor elements, or null
 * @returns {Array} 4 corner points [{x,y}, {x,y}, {x,y}, {x,y}] of the shaft rectangle
 */
export function computeShaftRect(openingPoints, shaftDepth, corridorCentroid) {
    const p1 = openingPoints[0]
    const p2 = openingPoints[1]

    const dx = p2.x - p1.x
    const dy = p2.y - p1.y

    // Perpendicular direction (normalised)
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return null

    // Two possible perpendicular directions: (-dy, dx) and (dy, -dx)
    let perpX = -dy / len
    let perpY = dx / len

    // If we have a corridor centroid, ensure the shaft goes AWAY from it
    if (corridorCentroid) {
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        // Vector from opening midpoint to corridor centroid
        const toCorridorX = corridorCentroid.x - midX
        const toCorridorY = corridorCentroid.y - midY
        // Dot product: if perpendicular points toward corridor, flip it
        const dot = perpX * toCorridorX + perpY * toCorridorY
        if (dot > 0) {
            perpX = -perpX
            perpY = -perpY
        }
    }

    // Shaft rectangle: opening line is one edge, extend by shaftDepth in perp direction
    const offsetX = perpX * shaftDepth
    const offsetY = perpY * shaftDepth

    return [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p2.x + offsetX, y: p2.y + offsetY },
        { x: p1.x + offsetX, y: p1.y + offsetY },
    ]
}
