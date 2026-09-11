/**
 * Find enclosed regions formed by orthogonal wall segments.
 *
 * Takes all obstruction polyline elements and finds closed polygonal regions
 * by building an edge graph and walking faces. Handles T-junctions where
 * a wall endpoint lands on the interior of another wall's edge.
 *
 * @param {Array} elements - all canvas elements
 * @param {number} [tolerance=5] - snap distance for connecting endpoints (in pixels)
 * @returns {Array} array of regions, each is { points: [{x,y},...], id: string }
 */
export function findEnclosedRegions(elements, tolerance = 5) {
    const wallElements = elements.filter(el => el.comments === 'obstruction')
    if (wallElements.length === 0) return []

    // 1. Extract all line segments from obstruction polylines
    const segments = []
    for (const el of wallElements) {
        const pts = el.points
        for (let i = 0; i < pts.length - 1; i++) {
            segments.push({ p1: { x: pts[i].x, y: pts[i].y }, p2: { x: pts[i + 1].x, y: pts[i + 1].y } })
        }
    }

    if (segments.length === 0) return []

    // 1b. T-junction splitting: when a segment endpoint lands on the interior
    //     of another segment (within tolerance), split that segment so the
    //     graph has a node at the junction point.
    let changed = true
    while (changed) {
        changed = false
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i]
            for (let j = segments.length - 1; j >= 0; j--) {
                if (i === j) continue
                const other = segments[j]
                // Check each endpoint of seg against the interior of other
                for (const pt of [seg.p1, seg.p2]) {
                    // Is pt close to the line of other but NOT close to either endpoint?
                    const closeToP1 = Math.abs(pt.x - other.p1.x) < tolerance && Math.abs(pt.y - other.p1.y) < tolerance
                    const closeToP2 = Math.abs(pt.x - other.p2.x) < tolerance && Math.abs(pt.y - other.p2.y) < tolerance
                    if (closeToP1 || closeToP2) continue // endpoint-to-endpoint, not a T-junction

                    // Project pt onto the line segment other
                    const dx = other.p2.x - other.p1.x
                    const dy = other.p2.y - other.p1.y
                    const lenSq = dx * dx + dy * dy
                    if (lenSq === 0) continue
                    const t = ((pt.x - other.p1.x) * dx + (pt.y - other.p1.y) * dy) / lenSq
                    if (t <= 0.01 || t >= 0.99) continue // too close to endpoints

                    // Distance from pt to projected point on segment
                    const projX = other.p1.x + t * dx
                    const projY = other.p1.y + t * dy
                    const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2)
                    if (dist > tolerance) continue

                    // Split: replace other with two segments at the projected point.
                    // Snap the endpoint to the projection on the segment so both
                    // the split point and the original endpoint share exact coords.
                    pt.x = projX
                    pt.y = projY
                    const splitPt = { x: projX, y: projY }
                    segments.splice(j, 1,
                        { p1: other.p1, p2: splitPt },
                        { p1: splitPt, p2: other.p2 }
                    )
                    // Adjust i if needed since we spliced before or at i
                    if (j <= i) i++
                    changed = true
                    break
                }
                if (changed) break
            }
            if (changed) break
        }
    }

    // 2. Build unique nodes by snapping close endpoints
    const nodes = []
    const nodeMap = new Map() // "x,y" -> node index

    function findOrCreateNode(x, y) {
        // Check existing nodes within tolerance
        for (let i = 0; i < nodes.length; i++) {
            if (Math.abs(nodes[i].x - x) < tolerance && Math.abs(nodes[i].y - y) < tolerance) {
                return i
            }
        }
        const idx = nodes.length
        nodes.push({ x, y })
        return idx
    }

    // 3. Build adjacency list
    const edges = [] // { from, to }
    const adj = [] // adj[nodeIdx] = [{ to, edgeIdx }]

    for (const seg of segments) {
        const n1 = findOrCreateNode(seg.p1.x, seg.p1.y)
        const n2 = findOrCreateNode(seg.p2.x, seg.p2.y)
        if (n1 === n2) continue // degenerate segment

        // Add edge in both directions
        const eIdx1 = edges.length
        edges.push({ from: n1, to: n2, used: false })
        const eIdx2 = edges.length
        edges.push({ from: n2, to: n1, used: false })

        // Set up twin indices
        edges[eIdx1].twin = eIdx2
        edges[eIdx2].twin = eIdx1

        while (adj.length <= Math.max(n1, n2)) adj.push([])
        adj[n1].push({ to: n2, edgeIdx: eIdx1 })
        adj[n2].push({ to: n1, edgeIdx: eIdx2 })
    }

    // Ensure adj is fully initialized
    while (adj.length < nodes.length) adj.push([])

    // 4. Sort adjacency lists by angle (for consistent face traversal)
    for (let i = 0; i < nodes.length; i++) {
        adj[i].sort((a, b) => {
            const angleA = Math.atan2(nodes[a.to].y - nodes[i].y, nodes[a.to].x - nodes[i].x)
            const angleB = Math.atan2(nodes[b.to].y - nodes[i].y, nodes[b.to].x - nodes[i].x)
            return angleA - angleB
        })
    }

    // 5. Find faces by walking edges — always take the next edge clockwise
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
                    // Completed a face
                    faces.push(face.slice())
                }
                break
            }

            usedEdges.add(currentEdgeIdx)
            const edge = edges[currentEdgeIdx]
            face.push(edge.from)

            // Find next edge: at node edge.to, find the twin's position in adj list,
            // then take the next one (clockwise)
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

            // Next edge clockwise: one position after the twin in sorted adj list
            const nextPos = (twinPos + 1) % nodeAdj.length
            currentEdgeIdx = nodeAdj[nextPos].edgeIdx

            steps++
        }
    }

    // 6. Convert faces to regions. In pixel space (y=down), interior face
    //    traversals produce negative signed area; outer/aggregate faces (true
    //    outer boundary and outer faces of disconnected components) produce
    //    positive signed area. Keep only the interior faces.
    const regions = []
    for (let i = 0; i < faces.length; i++) {
        const faceNodes = faces[i]
        if (faceNodes.length < 3) continue

        const points = faceNodes.map(ni => ({ x: nodes[ni].x, y: nodes[ni].y }))

        let signedArea = 0
        for (let j = 0; j < points.length; j++) {
            const p1 = points[j]
            const p2 = points[(j + 1) % points.length]
            signedArea += (p1.x * p2.y - p2.x * p1.y)
        }
        signedArea /= 2

        if (Math.abs(signedArea) < 100) continue // degenerate
        if (signedArea > 0) continue // outer / aggregated face

        regions.push({
            points,
            area: Math.abs(signedArea),
            id: `region_${i}`,
        })
    }

    regions.sort((a, b) => a.area - b.area)

    return regions
}
