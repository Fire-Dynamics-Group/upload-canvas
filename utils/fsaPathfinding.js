/**
 * FSA Pathfinding Module
 *
 * Finds the shortest walking route from apartment door to stair door through
 * a corridor polygon, then places sensors at specific distances (2m, 4m, 15m)
 * along that route. Used for FSA (Fire Safety Assessment) scenarios.
 *
 * Ported from the Python exe: populate_fds_file/pathfinding.py + path_grid.py
 */

import { pointInPolygon } from './corridorCenterline'

/**
 * Check if a point touches the polygon boundary (is a vertex).
 * @param {number} x
 * @param {number} y
 * @param {Array<{x: number, y: number}>} vertices
 * @param {number} tolerance
 * @returns {boolean}
 */
function isOnBoundary(x, y, vertices, tolerance = 0.01) {
    for (const v of vertices) {
        if (Math.abs(x - v.x) < tolerance && Math.abs(y - v.y) < tolerance) {
            return true
        }
    }
    return false
}

/**
 * Create a grid of navigable nodes inside a polygon.
 * Points on the boundary are marked as walls.
 *
 * @param {Array<{x: number, y: number}>} vertices - polygon vertices in metres
 * @param {number} step - grid spacing in metres (default 0.2)
 * @returns {Array<Object>} grid nodes with {id, x, y, col, row, isWall}
 */
export function createBoundingGrid(vertices, step = 0.2) {
    const xs = vertices.map(v => v.x)
    const ys = vertices.map(v => v.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const polyX = vertices.map(v => v.x)
    const polyY = vertices.map(v => v.y)

    const grid = []
    const numStepsX = Math.ceil((maxX - minX) / step)
    const numStepsY = Math.ceil((maxY - minY) / step)

    for (let ci = 0; ci <= numStepsX; ci++) {
        const x = Math.round((minX + step * ci) * 10) / 10
        for (let ri = 0; ri <= numStepsY; ri++) {
            const y = Math.round((minY + step * ri) * 10) / 10
            const inside = pointInPolygon(x, y, polyX, polyY)
            const onBound = isOnBoundary(x, y, vertices)

            if (inside || onBound) {
                grid.push({
                    id: `x${x}y${y}`,
                    x,
                    y,
                    col: ci,
                    row: ri,
                    isWall: onBound && !inside,
                })
            }
        }
    }
    return grid
}

/**
 * Find the closest non-wall grid node to a given point.
 *
 * @param {{x: number, y: number}} point
 * @param {Array<Object>} grid
 * @returns {Object|null}
 */
export function findClosestNode(point, grid) {
    let nearest = null
    let bestDist = Infinity

    for (const node of grid) {
        if (node.isWall) continue
        const d = Math.sqrt((node.x - point.x) ** 2 + (node.y - point.y) ** 2)
        if (d < bestDist) {
            bestDist = d
            nearest = node
        }
    }
    return nearest
}

/**
 * Euclidean distance between two points.
 */
function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/**
 * Build a spatial index for O(1) neighbour lookups by (col, row).
 * @param {Array<Object>} grid
 * @returns {Map<string, Object>}
 */
function buildGridIndex(grid) {
    const index = new Map()
    for (const node of grid) {
        index.set(`${node.col},${node.row}`, node)
    }
    return index
}

/**
 * Dijkstra's shortest path through the grid.
 * Uses extended neighbourhood (not just 8-adjacent) for smoother diagonal paths.
 *
 * @param {Object} start - start node from grid
 * @param {Object} end - end node from grid
 * @param {Array<Object>} grid
 * @returns {Array<{x: number, y: number}>|null} path as coordinate list, or null
 */
export function dijkstra(start, end, grid) {
    const index = buildGridIndex(grid)
    const idToNode = new Map()
    const distances = new Map()
    const prev = new Map()

    for (const node of grid) {
        idToNode.set(node.id, node)
        distances.set(node.id, Infinity)
        prev.set(node.id, null)
    }

    // If end node isn't in the grid, it's unreachable
    if (!distances.has(end.id)) return null

    distances.set(start.id, 0)

    // Simple priority queue (array-based, sufficient for grid sizes we use)
    const pq = [{ dist: 0, id: start.id }]
    const visited = new Set()

    function getNeighbours(col, row) {
        const neighbours = []

        // Immediate 8 neighbours
        for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (dc === 0 && dr === 0) continue
                const node = index.get(`${col + dc},${row + dr}`)
                if (node && !node.isWall) neighbours.push(node)
            }
        }

        // Extended neighbours for smoother paths (±2 to ±3 range)
        const extended = [
            [-1, 2], [1, 2], [-1, -2], [1, -2],
            [-2, 1], [2, 1], [-2, -1], [2, -1],
            [-1, 3], [1, 3], [-1, -3], [1, -3],
            [-3, 1], [3, 1], [-3, -1], [3, -1],
        ]
        for (const [dc, dr] of extended) {
            const node = index.get(`${col + dc},${row + dr}`)
            if (node && !node.isWall) neighbours.push(node)
        }

        return neighbours
    }

    while (pq.length > 0) {
        // Extract min distance node
        let minIdx = 0
        for (let i = 1; i < pq.length; i++) {
            if (pq[i].dist < pq[minIdx].dist) minIdx = i
        }
        const current = pq[minIdx]
        pq.splice(minIdx, 1)

        if (visited.has(current.id)) continue
        visited.add(current.id)

        if (current.id === end.id) break

        const cNode = idToNode.get(current.id)
        if (!cNode) continue

        const neighbours = getNeighbours(cNode.col, cNode.row)

        for (const neighbor of neighbours) {
            if (visited.has(neighbor.id)) continue
            const d = current.dist + dist(cNode, neighbor)
            if (d < distances.get(neighbor.id)) {
                distances.set(neighbor.id, d)
                prev.set(neighbor.id, current.id)
                pq.push({ dist: d, id: neighbor.id })
            }
        }
    }

    // Reconstruct path
    if (distances.get(end.id) === Infinity) return null

    const pathIds = []
    let currentId = end.id
    while (currentId !== null) {
        pathIds.push(currentId)
        currentId = prev.get(currentId)
    }
    pathIds.reverse()

    return pathIds.map(id => {
        const node = idToNode.get(id)
        return { x: node.x, y: node.y }
    })
}

/**
 * Walk along a path and find the coordinates at specific cumulative distances.
 *
 * @param {Array<{x: number, y: number}>} path - ordered path points
 * @param {number[]} sensorDistances - distances in metres (default [2, 4, 15])
 * @returns {Object} { distance: {x, y} } for each reachable distance
 */
export function findFsaSensorLocationsFromPath(path, sensorDistances = [2, 4, 15]) {
    if (path.length < 2) return {}

    // Build cumulative distance list
    const segmentDists = []
    for (let i = 0; i < path.length - 1; i++) {
        segmentDists.push(dist(path[i], path[i + 1]))
    }
    const cumDists = []
    let sum = 0
    for (const d of segmentDists) {
        sum += d
        cumDists.push(Math.round(sum * 1000) / 1000)
    }

    const sensorLocations = {}
    for (const target of sensorDistances) {
        for (let i = 0; i < cumDists.length; i++) {
            if (cumDists[i] >= target) {
                sensorLocations[target] = { x: path[i + 1].x, y: path[i + 1].y }
                break
            }
        }
    }
    return sensorLocations
}

/**
 * Run the full FSA pathfinding pipeline.
 *
 * @param {{x: number, y: number}} startPoint - apartment door midpoint (metres)
 * @param {{x: number, y: number}} endPoint - stair door midpoint (metres)
 * @param {Array<{x: number, y: number}>} corridorVertices - corridor polygon vertices (metres)
 * @param {Object} options
 * @param {number} options.gridStep - grid spacing in metres (default 0.2)
 * @param {number[]} options.sensorDistances - distances to place sensors (default [2, 4, 15])
 * @returns {{ path: Array<{x,y}>, sensorLocations: Object, maxDistance: number } | null}
 */
export function runFsaPathfinding(startPoint, endPoint, corridorVertices, options = {}) {
    const { gridStep = 0.2, sensorDistances = [2, 4, 15] } = options

    const grid = createBoundingGrid(corridorVertices, gridStep)
    if (grid.length === 0) return null

    const startNode = findClosestNode(startPoint, grid)
    const endNode = findClosestNode(endPoint, grid)
    if (!startNode || !endNode) return null

    const path = dijkstra(startNode, endNode, grid)
    if (!path || path.length < 2) return null

    const sensorLocations = findFsaSensorLocationsFromPath(path, sensorDistances)

    // Calculate max walking distance
    let maxDistance = 0
    for (let i = 0; i < path.length - 1; i++) {
        maxDistance += dist(path[i], path[i + 1])
    }

    return {
        path,
        sensorLocations,
        maxDistance: Math.round(maxDistance * 1000) / 1000,
    }
}
