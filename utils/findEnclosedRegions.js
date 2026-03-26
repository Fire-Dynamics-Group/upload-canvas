/**
 * Find enclosed regions formed by wall segments.
 *
 * Takes all obstruction polyline elements (and doors as virtual walls) and finds
 * closed polygonal regions by building an edge graph and walking faces.
 *
 * Handles T-junctions by splitting segments where an endpoint from one segment
 * lands on the interior of another segment.
 *
 * @param {Array} elements - all canvas elements
 * @param {number} tolerance - snap distance for connecting endpoints (in pixels)
 * @returns {Array} array of regions, each is { points: [{x,y},...], area: number, id: string }
 */
export function findEnclosedRegions(elements, tolerance = 5) {
    const obstructions = elements.filter(el => el.comments === 'obstruction')
    if (obstructions.length === 0) return []

    // Helper: round to 1 decimal to avoid floating point mismatches
    const r = v => Math.round(v * 10) / 10

    // 1. Extract all line segments from obstruction polylines
    let segments = []
    for (const obs of obstructions) {
        const pts = obs.points
        for (let i = 0; i < pts.length - 1; i++) {
            segments.push({ p1: { x: r(pts[i].x), y: r(pts[i].y) }, p2: { x: r(pts[i + 1].x), y: r(pts[i + 1].y) } })
        }
    }

    // 1b. Add door segments as virtual wall edges (doors close gaps between walls)
    const doors = elements.filter(el => el.comments === 'door')
    for (const door of doors) {
        const pts = door.points
        if (pts.length < 2) continue
        segments.push({ p1: { x: r(pts[0].x), y: r(pts[0].y) }, p2: { x: r(pts[pts.length - 1].x), y: r(pts[pts.length - 1].y) } })
    }

    if (segments.length === 0) return []

    // 2. Split segments at T-junctions.
    // If an endpoint from any segment lands on the interior of another segment,
    // split that segment into two at the junction point.
    segments = splitAtTJunctions(segments, tolerance)

    // 3. Build unique nodes by snapping close endpoints
    const nodes = []

    function findOrCreateNode(x, y) {
        for (let i = 0; i < nodes.length; i++) {
            if (Math.abs(nodes[i].x - x) < tolerance && Math.abs(nodes[i].y - y) < tolerance) {
                return i
            }
        }
        const idx = nodes.length
        nodes.push({ x, y })
        return idx
    }

    // 4. Build adjacency list with twin edges
    const edges = []
    const adj = []

    for (const seg of segments) {
        const n1 = findOrCreateNode(seg.p1.x, seg.p1.y)
        const n2 = findOrCreateNode(seg.p2.x, seg.p2.y)
        if (n1 === n2) continue

        const eIdx1 = edges.length
        edges.push({ from: n1, to: n2 })
        const eIdx2 = edges.length
        edges.push({ from: n2, to: n1 })

        edges[eIdx1].twin = eIdx2
        edges[eIdx2].twin = eIdx1

        while (adj.length <= Math.max(n1, n2)) adj.push([])
        adj[n1].push({ to: n2, edgeIdx: eIdx1 })
        adj[n2].push({ to: n1, edgeIdx: eIdx2 })
    }

    while (adj.length < nodes.length) adj.push([])

    // 5. Sort adjacency lists by angle (for consistent clockwise face traversal)
    for (let i = 0; i < nodes.length; i++) {
        adj[i].sort((a, b) => {
            const angleA = Math.atan2(nodes[a.to].y - nodes[i].y, nodes[a.to].x - nodes[i].x)
            const angleB = Math.atan2(nodes[b.to].y - nodes[i].y, nodes[b.to].x - nodes[i].x)
            return angleA - angleB
        })
    }

    // 6. Find faces by walking edges — always take the next edge clockwise
    const usedEdges = new Set()
    const faces = []

    for (let startEdgeIdx = 0; startEdgeIdx < edges.length; startEdgeIdx++) {
        if (usedEdges.has(startEdgeIdx)) continue

        const face = []
        let currentEdgeIdx = startEdgeIdx
        let steps = 0
        const maxSteps = edges.length + 1

        while (steps < maxSteps) {
            if (usedEdges.has(currentEdgeIdx)) {
                if (currentEdgeIdx === startEdgeIdx && face.length >= 3) {
                    faces.push(face.slice())
                }
                break
            }

            usedEdges.add(currentEdgeIdx)
            const edge = edges[currentEdgeIdx]
            face.push(edge.from)

            const twinIdx = edge.twin
            const nodeAdj = adj[edge.to]
            let twinPos = -1
            for (let i = 0; i < nodeAdj.length; i++) {
                if (nodeAdj[i].edgeIdx === twinIdx) {
                    twinPos = i
                    break
                }
            }

            if (twinPos === -1 || nodeAdj.length <= 1) break

            const nextPos = (twinPos + 1) % nodeAdj.length
            currentEdgeIdx = nodeAdj[nextPos].edgeIdx

            steps++
        }
    }

    // 7. Convert faces to regions, filter degenerate and outer boundary
    const regions = []
    for (let i = 0; i < faces.length; i++) {
        const faceNodes = faces[i]
        if (faceNodes.length < 3) continue

        const points = faceNodes.map(ni => ({ x: nodes[ni].x, y: nodes[ni].y }))

        let area = 0
        for (let j = 0; j < points.length; j++) {
            const p1 = points[j]
            const p2 = points[(j + 1) % points.length]
            area += (p1.x * p2.y - p2.x * p1.y)
        }
        area /= 2

        if (Math.abs(area) < 100) continue

        const cx = Math.round(points.reduce((s, p) => s + p.x, 0) / points.length)
        const cy = Math.round(points.reduce((s, p) => s + p.y, 0) / points.length)
        regions.push({
            points,
            area: Math.abs(area),
            id: `region_${cx}_${cy}`,
        })
    }

    regions.sort((a, b) => a.area - b.area)

    // Remove the largest region (outer boundary)
    if (regions.length > 1) {
        regions.pop()
    }

    return regions
}

/**
 * Split segments at T-junctions.
 *
 * For each endpoint of every segment, check if it lies on the interior of
 * another segment (within tolerance). If so, split that segment at the point.
 *
 * @param {Array} segments - array of {p1: {x,y}, p2: {x,y}}
 * @param {number} tolerance
 * @returns {Array} new segments with splits applied
 */
function splitAtTJunctions(segments, tolerance) {
    // Collect all unique endpoints
    const endpoints = []
    for (const seg of segments) {
        endpoints.push(seg.p1, seg.p2)
    }

    // For each segment, find all endpoints that lie on its interior and split
    let result = []
    for (const seg of segments) {
        const splitPoints = []
        for (const ep of endpoints) {
            // Skip if ep is one of the segment's own endpoints
            if (Math.abs(ep.x - seg.p1.x) < tolerance && Math.abs(ep.y - seg.p1.y) < tolerance) continue
            if (Math.abs(ep.x - seg.p2.x) < tolerance && Math.abs(ep.y - seg.p2.y) < tolerance) continue

            if (pointOnSegment(ep, seg.p1, seg.p2, tolerance)) {
                splitPoints.push(ep)
            }
        }

        if (splitPoints.length === 0) {
            result.push(seg)
        } else {
            // Sort split points by distance from p1
            splitPoints.sort((a, b) => {
                const da = (a.x - seg.p1.x) ** 2 + (a.y - seg.p1.y) ** 2
                const db = (b.x - seg.p1.x) ** 2 + (b.y - seg.p1.y) ** 2
                return da - db
            })

            // Create sub-segments: p1 -> split1 -> split2 -> ... -> p2
            let prev = seg.p1
            for (const sp of splitPoints) {
                result.push({ p1: { x: prev.x, y: prev.y }, p2: { x: sp.x, y: sp.y } })
                prev = sp
            }
            result.push({ p1: { x: prev.x, y: prev.y }, p2: { x: seg.p2.x, y: seg.p2.y } })
        }
    }

    return result
}

/**
 * Check if point p lies on segment (a, b) within tolerance.
 * Uses projection: checks that p is close to the line defined by a-b
 * AND that the projection falls between a and b.
 */
function pointOnSegment(p, a, b, tolerance) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < tolerance * tolerance) return false // degenerate segment

    // Project p onto line a-b
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
    if (t <= 0 || t >= 1) return false // outside segment interior

    // Distance from p to projected point
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    const dist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)

    return dist < tolerance
}
