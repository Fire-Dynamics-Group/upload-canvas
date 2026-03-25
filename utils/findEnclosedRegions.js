/**
 * Find enclosed regions formed by orthogonal wall segments.
 *
 * Takes all obstruction polyline elements and finds closed polygonal regions
 * by building an edge graph and walking faces.
 *
 * @param {Array} elements - all canvas elements
 * @param {number} tolerance - snap distance for connecting endpoints (in pixels)
 * @returns {Array} array of regions, each is { points: [{x,y},...], id: string }
 */
export function findEnclosedRegions(elements, tolerance = 5) {
    const obstructions = elements.filter(el => el.comments === 'obstruction')
    if (obstructions.length === 0) return []

    // 1. Extract all line segments from obstruction polylines
    const segments = []
    for (const obs of obstructions) {
        const pts = obs.points
        for (let i = 0; i < pts.length - 1; i++) {
            segments.push({ p1: { x: pts[i].x, y: pts[i].y }, p2: { x: pts[i + 1].x, y: pts[i + 1].y } })
        }
    }

    if (segments.length === 0) return []

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

    // 6. Convert faces from node indices to point arrays, filter out the outer boundary
    const regions = []
    for (let i = 0; i < faces.length; i++) {
        const faceNodes = faces[i]
        if (faceNodes.length < 3) continue

        const points = faceNodes.map(ni => ({ x: nodes[ni].x, y: nodes[ni].y }))

        // Compute signed area to determine winding — skip the outer face (largest area, usually negative)
        let area = 0
        for (let j = 0; j < points.length; j++) {
            const p1 = points[j]
            const p2 = points[(j + 1) % points.length]
            area += (p1.x * p2.y - p2.x * p1.y)
        }
        area /= 2

        // Skip very small faces (degenerate) and the outer boundary (negative/largest area)
        if (Math.abs(area) < 100) continue // too small (in pixel space)

        regions.push({
            points,
            area: Math.abs(area),
            id: `region_${i}`,
        })
    }

    // Sort by area ascending — smaller rooms first, outer boundary last
    regions.sort((a, b) => a.area - b.area)

    // Remove the largest region (outer boundary)
    if (regions.length > 1) {
        regions.pop()
    }

    return regions
}
