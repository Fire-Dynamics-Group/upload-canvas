/**
 * Detect normal obstructions that have been drawn inside a stair mesh region.
 *
 * Elements are tagged only by their `comments` string: a normal wall is
 * `'obstruction'`, a staircase edge is `'stairObstruction'`, and the stair
 * computational domain is a `'stairMesh'` rectangle. A common mistake is to
 * draw a plain `'obstruction'` inside the stair mesh — it then exports as a
 * solid OBST instead of being turned into steps. This module flags that case
 * (advisory only) and provides a one-click reclassification.
 */

function rectBounds(rectPoints) {
    const [a, b] = rectPoints
    return {
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
    }
}

function pointInBounds(p, bounds) {
    return p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY
}

function orientation(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
}

// Do segments p1->p2 and p3->p4 intersect? (proper crossing, no collinear handling)
function segmentsIntersect(p1, p2, p3, p4) {
    const d1 = orientation(p3, p4, p1)
    const d2 = orientation(p3, p4, p2)
    const d3 = orientation(p1, p2, p3)
    const d4 = orientation(p1, p2, p4)
    return d1 * d2 < 0 && d3 * d4 < 0
}

function rectEdges(bounds) {
    const tl = { x: bounds.minX, y: bounds.minY }
    const tr = { x: bounds.maxX, y: bounds.minY }
    const br = { x: bounds.maxX, y: bounds.maxY }
    const bl = { x: bounds.minX, y: bounds.maxY }
    return [[tl, tr], [tr, br], [br, bl], [bl, tl]]
}

function obstructionOverlapsMesh(obstruction, mesh) {
    const bounds = rectBounds(mesh.points)
    const pts = obstruction.points

    // Any vertex inside the mesh counts as overlap.
    if (pts.some((p) => pointInBounds(p, bounds))) return true

    // Otherwise, any polyline segment crossing a mesh edge counts as overlap.
    const edges = rectEdges(bounds)
    for (let i = 0; i < pts.length - 1; i++) {
        for (const [e1, e2] of edges) {
            if (segmentsIntersect(pts[i], pts[i + 1], e1, e2)) return true
        }
    }
    return false
}

/**
 * @param {Array} elements - all canvas elements
 * @returns {Array} the `'obstruction'` elements overlapping any `'stairMesh'`
 */
export function findMisclassifiedObstructions(elements) {
    const stairMeshes = elements.filter((el) => el.comments === 'stairMesh')
    const obstructions = elements.filter((el) => el.comments === 'obstruction')
    return obstructions.filter((obst) => stairMeshes.some((mesh) => obstructionOverlapsMesh(obst, mesh)))
}

/**
 * Reclassify the given elements as stair obstructions. Pure: returns a new
 * array with new element objects, leaving the input untouched.
 *
 * Targets are matched by object **identity**, not by `id` — element ids are not
 * guaranteed unique in a loaded project, and matching by id would flip every
 * obstruction sharing an id with a flagged one (including walls far from the
 * stairs). Pass the actual element objects from `elements`.
 *
 * @param {Array} elements - all canvas elements
 * @param {Array|Set} targets - element objects (from `elements`) to convert
 * @returns {Array} a new elements array
 */
export function convertToStairObstruction(elements, targets) {
    const targetSet = targets instanceof Set ? targets : new Set(targets)
    return elements.map((el) => (targetSet.has(el) ? { ...el, comments: 'stairObstruction' } : el))
}
