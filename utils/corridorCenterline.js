/**
 * Find intersections of a perpendicular ray with polygon edges.
 * @param {Array<{x: number, y: number}>} polyPoints - polygon vertices
 * @param {number} axisPos - position along the corridor axis to cast the ray
 * @param {boolean} isHorizontal - true if corridor runs along X (ray cast along Y)
 * @returns {[number, number] | null} [min, max] of intersections, or null
 */
export function findPerpendicularBounds(polyPoints, axisPos, isHorizontal) {
    const intersections = collectRayIntersections(polyPoints, axisPos, isHorizontal)
    if (intersections.length < 2) return null
    return [Math.min(...intersections), Math.max(...intersections)]
}

/**
 * Find all intersection segments of a perpendicular ray with the polygon.
 * Returns paired entry/exit points so that for L/T-shaped polygons,
 * each disconnected corridor section gets its own segment.
 * @param {Array<{x: number, y: number}>} polyPoints - polygon vertices
 * @param {number} axisPos - position along the corridor axis
 * @param {boolean} isHorizontal - true if corridor runs along X (ray along Y)
 * @returns {Array<[number, number]>} array of [min, max] segments
 */
export function findPerpendicularSegments(polyPoints, axisPos, isHorizontal) {
    const intersections = collectRayIntersections(polyPoints, axisPos, isHorizontal)
    intersections.sort((a, b) => a - b)
    // Pair consecutive intersections: [entry, exit], [entry, exit], ...
    const segments = []
    for (let i = 0; i + 1 < intersections.length; i += 2) {
        segments.push([intersections[i], intersections[i + 1]])
    }
    return segments
}

function collectRayIntersections(polyPoints, axisPos, isHorizontal) {
    const intersections = []
    for (let i = 0; i < polyPoints.length; i++) {
        const a = polyPoints[i]
        const b = polyPoints[(i + 1) % polyPoints.length]
        if (isHorizontal) {
            const minX = Math.min(a.x, b.x)
            const maxX = Math.max(a.x, b.x)
            if (axisPos >= minX && axisPos <= maxX && a.x !== b.x) {
                const t = (axisPos - a.x) / (b.x - a.x)
                intersections.push(a.y + t * (b.y - a.y))
            }
        } else {
            const minY = Math.min(a.y, b.y)
            const maxY = Math.max(a.y, b.y)
            if (axisPos >= minY && axisPos <= maxY && a.y !== b.y) {
                const t = (axisPos - a.y) / (b.y - a.y)
                intersections.push(a.x + t * (b.x - a.x))
            }
        }
    }
    return intersections
}

/**
 * Determine corridor axis direction from door positions.
 * @param {Array} doorElements - door elements with points
 * @param {Object} doorRoles - { [doorId]: role }
 * @returns {'horizontal' | 'vertical' | null}
 */
export function getCorridorAxis(doorElements, doorRoles) {
    const corridorDoors = doorElements.filter(d => {
        const role = doorRoles[d.id]
        return role === 'apartment' || role === 'stair' || role === 'lobby'
    })
    if (corridorDoors.length < 2) return null

    const centers = corridorDoors.map(d => ({
        x: (d.points[0].x + d.points[1].x) / 2,
        y: (d.points[0].y + d.points[1].y) / 2,
    }))
    const dx = Math.max(...centers.map(c => c.x)) - Math.min(...centers.map(c => c.x))
    const dy = Math.max(...centers.map(c => c.y)) - Math.min(...centers.map(c => c.y))
    return dx > dy ? 'horizontal' : 'vertical'
}

/**
 * Get the corridor range along the main axis from door positions.
 * @param {Array} doorElements
 * @param {Object} doorRoles
 * @param {boolean} isHorizontal
 * @returns {{ min: number, max: number } | null}
 */
export function getCorridorRange(doorElements, doorRoles, isHorizontal) {
    const corridorDoors = doorElements.filter(d => {
        const role = doorRoles[d.id]
        return role === 'apartment' || role === 'stair' || role === 'lobby'
    })
    if (corridorDoors.length < 2) return null

    const positions = corridorDoors.map(d => {
        const cx = (d.points[0].x + d.points[1].x) / 2
        const cy = (d.points[0].y + d.points[1].y) / 2
        return isHorizontal ? cx : cy
    })
    return { min: Math.min(...positions), max: Math.max(...positions) }
}

/**
 * Find the obstruction polygon that interfaces with the corridor doors.
 * Checks which polygon has door endpoints closest to its edges.
 *
 * @param {Array} obstructions - obstruction elements
 * @param {Array} doorElements - door elements
 * @param {Object} doorRoles - { [doorId]: role }
 * @returns {Object|null} the obstruction element whose polygon touches the corridor doors
 */
export function findCorridorObstruction(obstructions, doorElements, doorRoles) {
    const corridorDoors = doorElements.filter(d => {
        const role = doorRoles[d.id]
        return role === 'apartment' || role === 'stair' || role === 'lobby'
    })
    if (corridorDoors.length < 2 || obstructions.length === 0) {
        // Fallback: largest obstruction
        return obstructions.reduce((a, b) => a.points.length > b.points.length ? a : b, obstructions[0])
    }

    // For each obstruction, check how close the corridor doors are to its edges
    let bestObs = null
    let bestScore = Infinity

    for (const obs of obstructions) {
        let totalDist = 0
        for (const door of corridorDoors) {
            const doorMid = {
                x: (door.points[0].x + door.points[1].x) / 2,
                y: (door.points[0].y + door.points[1].y) / 2,
            }
            // Find minimum distance from door midpoint to any edge of this obstruction
            let minDist = Infinity
            for (let i = 0; i < obs.points.length - 1; i++) {
                const a = obs.points[i]
                const b = obs.points[i + 1]
                const dist = pointToSegmentDistance(doorMid, a, b)
                if (dist < minDist) minDist = dist
            }
            totalDist += minDist
        }
        if (totalDist < bestScore) {
            bestScore = totalDist
            bestObs = obs
        }
    }
    return bestObs
}

function pointToSegmentDistance(p, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
        const ex = p.x - a.x, ey = p.y - a.y
        return Math.sqrt(ex * ex + ey * ey)
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const proj = { x: a.x + t * dx, y: a.y + t * dy }
    const ex = p.x - proj.x, ey = p.y - proj.y
    return Math.sqrt(ex * ex + ey * ey)
}

/**
 * Point-in-polygon test using ray casting algorithm.
 * @param {number} x
 * @param {number} y
 * @param {number[]} polyX - polygon X coordinates
 * @param {number[]} polyY - polygon Y coordinates
 * @returns {boolean}
 */
export function pointInPolygon(x, y, polyX, polyY) {
    const n = polyX.length
    let inside = false
    let p1x = polyX[0], p1y = polyY[0]
    for (let i = 1; i <= n; i++) {
        const p2x = polyX[i % n]
        const p2y = polyY[i % n]
        if (y > Math.min(p1y, p2y)) {
            if (y <= Math.max(p1y, p2y)) {
                if (x <= Math.max(p1x, p2x)) {
                    if (p1y !== p2y) {
                        const xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if (p1x === p2x || x <= xinters) {
                            inside = !inside
                        }
                    }
                }
            }
        }
        p1x = p2x
        p1y = p2y
    }
    return inside
}

/**
 * Check if a rectangle lies within a polygon by testing corners and edge midpoints.
 * @param {number} xMin
 * @param {number} xMax
 * @param {number} yMin
 * @param {number} yMax
 * @param {number[]} polyX
 * @param {number[]} polyY
 * @returns {boolean}
 */
function checkRectWithinPoly(xMin, xMax, yMin, yMax, polyX, polyY) {
    const diff = 0.01
    const x1 = xMin + diff, y1 = yMin + diff
    const x2 = xMax - diff, y2 = yMax - diff
    const corners = [[x1, y1], [x1, y2], [x2, y1], [x2, y2]]
    for (let i = 0; i < corners.length; i++) {
        if (!pointInPolygon(corners[i][0], corners[i][1], polyX, polyY)) return false
        const j = (i + 1) % corners.length
        // Check midpoint of edge
        let mx, my
        if (corners[i][0] === corners[j][0]) {
            mx = corners[i][0]
            my = (corners[i][1] + corners[j][1]) / 2
        } else {
            mx = (corners[i][0] + corners[j][0]) / 2
            my = corners[i][1]
        }
        if (!pointInPolygon(mx, my, polyX, polyY)) return false
    }
    return true
}

/**
 * Compute polygon area using the shoelace formula.
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number}
 */
function polygonArea(xs, ys) {
    const n = xs.length
    let sum = 0
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        sum += xs[i] * ys[j] - ys[i] * xs[j]
    }
    return Math.abs(sum) / 2
}

/**
 * Decompose a polygon into sub-rectangles.
 * For 4-point shapes: slices into 1m segments along the long axis.
 * For complex polygons: uses Monte Carlo to find optimal decomposition.
 *
 * @param {Array<{x: number, y: number}>} points - polygon vertices in metres
 * @returns {number[]} flat array [xmin, xmax, ymin, ymax, ...] of rectangles
 */
export function getBestRectangles(points) {
    const rawXs = points.map(p => p.x)
    const rawYs = points.map(p => p.y)

    // Simple 4-point rectangle: slice into 1m segments
    if (rawXs.length === 4) {
        const xMin = Math.min(...rawXs)
        const xMax = Math.max(...rawXs)
        const yMin = Math.min(...rawYs)
        const yMax = Math.max(...rawYs)
        const deltaX = xMax - xMin
        const deltaY = yMax - yMin
        const rectangles = []

        if (deltaX > deltaY) {
            const numSegments = Math.floor(deltaX)
            for (let i = 0; i < numSegments; i++) {
                const startX = xMin + i
                const endX = Math.min(startX + 1, xMax)
                rectangles.push(startX, endX, yMin, yMax)
            }
        } else {
            const numSegments = Math.floor(deltaY)
            for (let i = 0; i < numSegments; i++) {
                const startY = yMin + i
                const endY = Math.min(startY + 1, yMax)
                rectangles.push(xMin, xMax, startY, endY)
            }
        }
        return rectangles
    }

    // Round coordinates to 1 decimal place so Counter-style matching works
    for (let i = 0; i < rawXs.length; i++) {
        rawXs[i] = Math.round(rawXs[i] * 10) / 10
        rawYs[i] = Math.round(rawYs[i] * 10) / 10
    }

    // Complex polygon: Monte Carlo rectangle decomposition
    const shapeArea = polygonArea(rawXs, rawYs)
    let bestRectangles = []
    let bestPerimeter = Infinity
    const maxIterations = 100000

    for (let test = 0; test < maxIterations; test++) {
        const rectangles = []
        const Xs = [...rawXs]
        const Ys = [...rawYs]

        while (Xs.length > 2) {
            const idx1 = Math.floor(Math.random() * Xs.length)
            let idx2, idx3
            if (idx1 > Xs.length - 2) {
                idx2 = 0; idx3 = 1
            } else if (idx1 > Xs.length - 3) {
                idx2 = idx1 + 1; idx3 = 0
            } else {
                idx2 = idx1 + 1; idx3 = idx1 + 2
            }
            const idx4 = idx1 === 0 ? Xs.length - 1 : idx1 - 1

            const x1 = Xs[idx1], x2 = Xs[idx2], x3 = Xs[idx3]
            const y1 = Ys[idx1], y2 = Ys[idx2], y3 = Ys[idx3]

            // Find the 4th corner from the 3 vertices
            const tempXs = [x1, x2, x3]
            const tempYs = [y1, y2, y3]
            const xCounts = {}
            tempXs.forEach(v => { xCounts[v] = (xCounts[v] || 0) + 1 })
            const yCounts = {}
            tempYs.forEach(v => { yCounts[v] = (yCounts[v] || 0) + 1 })
            const x4 = Object.keys(xCounts).reduce((a, b) => xCounts[a] <= xCounts[b] ? a : b)
            const y4 = Object.keys(yCounts).reduce((a, b) => yCounts[a] <= yCounts[b] ? a : b)

            const xMin = Math.min(x1, x2, x3)
            const xMax = Math.max(x1, x2, x3)
            const yMin = Math.min(y1, y2, y3)
            const yMax = Math.max(y1, y2, y3)

            rectangles.push(xMin, xMax, yMin, yMax)

            // Insert 4th coordinate and remove the 3 used vertices
            Xs.splice(idx4, 0, Number(x4))
            Ys.splice(idx4, 0, Number(y4))

            let indexes
            if (idx1 === 0) {
                indexes = [idx1, idx2, idx3]
            } else {
                indexes = [idx1 + 1, idx2 + 1, idx3 + 1]
            }
            indexes.sort((a, b) => b - a)
            for (const idx of indexes) {
                Xs.splice(idx, 1)
                Ys.splice(idx, 1)
            }
        }

        // Check if total rect area matches polygon area
        let rectArea = 0
        for (let i = 0; i < rectangles.length; i += 4) {
            rectArea += (rectangles[i + 1] - rectangles[i]) * (rectangles[i + 3] - rectangles[i + 2])
        }

        if (Math.abs(rectArea - shapeArea) < 0.1) {
            let perimeter = 0
            for (let i = 0; i < rectangles.length; i += 4) {
                perimeter += ((rectangles[i + 1] - rectangles[i]) + (rectangles[i + 3] - rectangles[i + 2])) * 2
            }
            if (perimeter < bestPerimeter) {
                bestPerimeter = perimeter
                bestRectangles = [...rectangles]
            }
        }
    }

    return bestRectangles
}

/**
 * Generate centerline sensor points from decomposed rectangles.
 * For each rectangle, insets 0.4m from walls and places points at spacing
 * intervals along the midline of the long axis.
 *
 * @param {number[]} rects - flat array [xmin, xmax, ymin, ymax, ...] in metres
 * @param {number} spacing - distance between points in metres (default 0.5)
 * @returns {Array<{x: number, y: number}>} centerline points in metres
 */
export function returnCenterlines(rects, spacing = 0.5) {
    const centrePoints = []

    for (let i = 0; i < Math.floor(rects.length / 4); i++) {
        const k = i * 4
        let xmin = rects[k] + 0.4
        let ymin = rects[k + 2] + 0.4
        let xmax = rects[k + 1] - 0.4
        let ymax = rects[k + 3] - 0.4

        const deltaX = xmax - xmin
        const deltaY = ymax - ymin

        // Skip rectangles too small after inset
        if (deltaX <= 0 && deltaY <= 0) continue

        let x, y
        if (deltaX > deltaY) {
            y = (ymax + ymin) / 2
        } else {
            x = (xmax + xmin) / 2
        }

        const walkDist = Math.max(deltaX, deltaY)
        if (walkDist <= 0) continue
        const numPts = Math.round(walkDist / spacing) + 1
        for (let j = 0; j < numPts; j++) {
            const main = spacing * j
            if (deltaX > deltaY) {
                x = main + xmin
            } else {
                y = main + ymin
            }
            centrePoints.push({
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
            })
        }
    }
    return centrePoints
}

/**
 * Compute centerline sensor points along BOTH axes of a corridor polygon.
 * Scans the polygon horizontally AND vertically at spacing intervals,
 * placing sensors at the midpoint of each scan line's intersection with the polygon.
 * This follows the exe pattern: sensors along centerlines in both orthogonal directions.
 *
 * @param {Array<{x: number, y: number}>} obstructionPoints - corridor polygon vertices (in pixels)
 * @param {Array} doorElements - door elements with points (reserved for future use)
 * @param {Object} doorRoles - { [doorId]: role } (reserved for future use)
 * @param {number} pixelsPerMesh - canvas scale factor
 * @param {number} spacing - sensor spacing in metres (default 0.5)
 * @param {number} inset - inset from polygon edges in metres (default 0.4)
 * @returns {Array<{x: number, y: number}>} sensor positions in pixel coords
 */
export function computeCenterlinePoints(
    obstructionPoints,
    doorElements,
    doorRoles,
    pixelsPerMesh,
    spacing = 0.5,
    inset = 0.4
) {
    const pxPerM = pixelsPerMesh * 10
    const polyX = obstructionPoints.map(p => p.x)
    const polyY = obstructionPoints.map(p => p.y)

    // Same as the EXE: convert to metres, run getBestRectangles to decompose
    // into sub-rectangles, then returnCenterlines to place sensors along each
    // rectangle's centerline. No scanning, no raycasting.
    const metrePoints = obstructionPoints.map(p => ({
        x: Math.round(p.x / pxPerM * 10) / 10,
        y: Math.round(p.y / pxPerM * 10) / 10,
    }))
    const rects = getBestRectangles(metrePoints)
    const centrelines = returnCenterlines(rects, spacing)

    // Junction extension: where two adjacent rectangles have perpendicular
    // centerlines, extend each centerline into the adjacent rect up to its
    // midpoint. This ensures both axes of sensors meet at T/L junctions.
    const parsedRects = []
    for (let i = 0; i < rects.length; i += 4) {
        const xmin = rects[i], xmax = rects[i + 1], ymin = rects[i + 2], ymax = rects[i + 3]
        const dx = (xmax - xmin) - 0.8 // after 0.4 inset each side
        const dy = (ymax - ymin) - 0.8
        const isHoriz = dx > dy
        parsedRects.push({
            xmin, xmax, ymin, ymax, isHoriz,
            // Centerline position on the non-walk axis
            centerVal: isHoriz ? (ymin + ymax) / 2 : (xmin + xmax) / 2,
        })
    }

    const extraSensors = []
    for (let i = 0; i < parsedRects.length; i++) {
        for (let j = i + 1; j < parsedRects.length; j++) {
            const a = parsedRects[i], b = parsedRects[j]
            if (a.isHoriz === b.isHoriz) continue // same direction, skip

            // Check if they share an edge (overlap on the shared boundary)
            const xOverlap = Math.min(a.xmax, b.xmax) - Math.max(a.xmin, b.xmin)
            const yOverlap = Math.min(a.ymax, b.ymax) - Math.max(a.ymin, b.ymin)
            if (xOverlap < -0.01 || yOverlap < -0.01) continue // no adjacency

            // They overlap — extend each into the other
            // For the horizontal rect: extend its y-centerline across the vertical rect's x-range, stopping at vertical rect's x-midpoint
            // For the vertical rect: extend its x-centerline across the horizontal rect's y-range, stopping at horizontal rect's y-midpoint
            const horiz = a.isHoriz ? a : b
            const vert = a.isHoriz ? b : a

            const vertMidX = (vert.xmin + vert.xmax) / 2
            const horizMidY = (horiz.ymin + horiz.ymax) / 2

            // Extend horizontal centerline into the vertical rect
            // From the shared edge to the vertical rect's x-midpoint
            const hY = horiz.centerVal
            const hXfrom = Math.min(vert.xmin, vertMidX)
            const hXto = Math.max(vert.xmin, vertMidX)
            for (let x = hXfrom; x <= hXto + 0.01; x += spacing) {
                extraSensors.push({
                    x: Math.round(x * 10) / 10,
                    y: Math.round(hY * 10) / 10,
                })
            }
            // Also extend from the other side of the vertical rect
            const hXfrom2 = Math.min(vert.xmax, vertMidX)
            const hXto2 = Math.max(vert.xmax, vertMidX)
            for (let x = hXfrom2; x <= hXto2 + 0.01; x += spacing) {
                extraSensors.push({
                    x: Math.round(x * 10) / 10,
                    y: Math.round(hY * 10) / 10,
                })
            }

            // Extend vertical centerline into the horizontal rect
            const vX = vert.centerVal
            const vYfrom = Math.min(horiz.ymin, horizMidY)
            const vYto = Math.max(horiz.ymin, horizMidY)
            for (let y = vYfrom; y <= vYto + 0.01; y += spacing) {
                extraSensors.push({
                    x: Math.round(vX * 10) / 10,
                    y: Math.round(y * 10) / 10,
                })
            }
            const vYfrom2 = Math.min(horiz.ymax, horizMidY)
            const vYto2 = Math.max(horiz.ymax, horizMidY)
            for (let y = vYfrom2; y <= vYto2 + 0.01; y += spacing) {
                extraSensors.push({
                    x: Math.round(vX * 10) / 10,
                    y: Math.round(y * 10) / 10,
                })
            }
        }
    }

    const allSensors = [...centrelines, ...extraSensors]

    // Convert back to pixels and deduplicate.
    const seen = new Set()
    const points = []
    for (const c of allSensors) {
        const px = { x: Math.round(c.x * pxPerM), y: Math.round(c.y * pxPerM) }
        const key = `${px.x},${px.y}`
        if (!seen.has(key)) {
            seen.add(key)
            points.push(px)
        }
    }
    return points
}

/**
 * Compute stair sensor positions behind the stair door, inside the stair polygon.
 * Places sensors at 0.8m and 1.8m offsets from the door into the stair.
 *
 * @param {Object} stairDoor - door element with points [{x,y}, {x,y}]
 * @param {Array<{x: number, y: number}>} stairPolyPoints - stair obstruction polygon vertices
 * @param {Object} landing - landing element with points [{x,y}, {x,y}] (rect corners)
 * @param {number} pixelsPerMesh - canvas scale factor
 * @returns {Array<{x: number, y: number}>} sensor positions in pixel coords (0, 1, or 2 positions)
 */
export function computeStairSensorPositions(stairDoor, stairPolyPoints, landing, pixelsPerMesh) {
    const pxPerM = pixelsPerMesh * 10

    const p0 = stairDoor.points[0]
    const p1 = stairDoor.points[1]
    const dx = Math.abs(p1.x - p0.x)
    const dy = Math.abs(p1.y - p0.y)

    // Determine door orientation
    // If door spans more in X, expand axis is X, non-expand is Y
    const expandIsX = dx > dy

    // Base position: midpoint along expand axis, at door's non-expand coordinate
    const midExpand = expandIsX
        ? (p0.x + p1.x) / 2
        : (p0.y + p1.y) / 2
    const doorNonExpand = expandIsX ? p0.y : p0.x

    // Landing center along non-expand axis
    const landingCenter = expandIsX
        ? (landing.points[0].y + landing.points[1].y) / 2
        : (landing.points[0].x + landing.points[1].x) / 2

    // Direction into stair: from door toward landing
    const direction = landingCenter > doorNonExpand ? 1 : -1

    const offsets = [0.8, 1.8] // metres
    const polyX = stairPolyPoints.map(p => p.x)
    const polyY = stairPolyPoints.map(p => p.y)

    const positions = []

    for (const offset of offsets) {
        const offsetPx = offset * pxPerM
        let testX, testY
        if (expandIsX) {
            testX = midExpand
            testY = doorNonExpand + direction * offsetPx
        } else {
            testX = doorNonExpand + direction * offsetPx
            testY = midExpand
        }

        if (pointInPolygon(testX, testY, polyX, polyY)) {
            positions.push({ x: Math.round(testX), y: Math.round(testY) })
        } else {
            // Try opposite direction
            if (expandIsX) {
                testY = doorNonExpand - direction * offsetPx
            } else {
                testX = doorNonExpand - direction * offsetPx
            }
            if (pointInPolygon(testX, testY, polyX, polyY)) {
                positions.push({ x: Math.round(testX), y: Math.round(testY) })
            }
        }
    }

    return positions
}
