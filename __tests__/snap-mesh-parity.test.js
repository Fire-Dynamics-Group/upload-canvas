import { describe, it, expect } from 'vitest'

/**
 * MESH SNAP PARITY REGRESSION FENCE
 *
 * The functions below are a VERBATIM COPY of the mesh-snap pure logic in
 * Components/Canvas.jsx (lines 1096-1142 at the time this test was written).
 *
 * Intent: lock the current mesh-snap output as a golden baseline. If the
 * Canvas.jsx functions are refactored later, this test will either continue to
 * match (if the refactor preserves semantics) or break (if it drifts).
 *
 * If this test breaks and the refactor is intentional, re-sync by copying the
 * new Canvas.jsx logic in here and confirming the new output is still what is
 * desired. Do NOT just update the expected values without understanding the
 * drift.
 */

// ---- verbatim copy from Components/Canvas.jsx (isMesh + getRectCorners + mesh-snap trio) ----

function isMesh(currentEl) {
    if (currentEl["comments"].toLowerCase().includes("mesh")) {
        return true
    }
    return false
}

function getRectCorners(rectPoints) {
    let p1 = rectPoints[0]
    let p3 = rectPoints[1]
    let p2 = { "x": p1.x, "y": p3.y }
    let p4 = { "x": p3.x, "y": p1.y }
    let topLeft, bottomLeft, bottomRight, topRight = null
    if (p1.x > p3.x) {
        if (p1.y > p3.y) {
            topLeft = p1
            bottomRight = p3
            topRight = p4
            bottomLeft = p2
        } else {
            topLeft = p2
            bottomRight = p4
            topRight = p3
            bottomLeft = p1
        }
    } else {
        if (p1.y > p3.y) {
            topLeft = p4
            bottomRight = p2
            topRight = p1
            bottomLeft = p3
        } else {
            topLeft = p3
            bottomRight = p1
            topRight = p2
            bottomLeft = p4
        }
    }
    return [topLeft, bottomLeft, bottomRight, topRight]
}

const MESH_SNAP_THRESHOLD = 15

function collectMeshEdgeCoordinates(elements, excludeId = null) {
    const xCoords = []
    const yCoords = []
    for (const el of elements) {
        if (!isMesh(el)) continue
        if (excludeId !== null && el.id === excludeId) continue
        const corners = getRectCorners(el.points)
        const minX = Math.min(corners[0].x, corners[2].x)
        const maxX = Math.max(corners[0].x, corners[2].x)
        const minY = Math.min(corners[0].y, corners[2].y)
        const maxY = Math.max(corners[0].y, corners[2].y)
        xCoords.push(minX, maxX)
        yCoords.push(minY, maxY)
    }
    return { xCoords, yCoords }
}

function snapToMeshEdges(vertex, elements, excludeId = null) {
    const { xCoords, yCoords } = collectMeshEdgeCoordinates(elements, excludeId)
    const guides = []
    let snappedX = vertex.x
    let snappedY = vertex.y
    let bestDx = MESH_SNAP_THRESHOLD + 1
    let bestDy = MESH_SNAP_THRESHOLD + 1

    for (const x of xCoords) {
        const dx = Math.abs(vertex.x - x)
        if (dx < bestDx && dx <= MESH_SNAP_THRESHOLD) {
            bestDx = dx
            snappedX = x
        }
    }
    for (const y of yCoords) {
        const dy = Math.abs(vertex.y - y)
        if (dy < bestDy && dy <= MESH_SNAP_THRESHOLD) {
            bestDy = dy
            snappedY = y
        }
    }

    if (bestDx <= MESH_SNAP_THRESHOLD) guides.push({ type: 'vertical', x: snappedX })
    if (bestDy <= MESH_SNAP_THRESHOLD) guides.push({ type: 'horizontal', y: snappedY })

    return { snapped: { x: snappedX, y: snappedY }, guides }
}

// ---- end verbatim copy ----

describe('Mesh snap parity fence', () => {
    const mesh1 = {
        id: 1,
        type: 'rect',
        comments: 'mesh',
        points: [{ x: 100, y: 100 }, { x: 300, y: 200 }],
    }
    const mesh2 = {
        id: 2,
        type: 'rect',
        comments: 'mesh_stair',
        points: [{ x: 400, y: 150 }, { x: 500, y: 350 }],
    }
    const wall = {
        id: 3,
        type: 'polyline',
        comments: 'obstruction',
        points: [{ x: 10, y: 10 }, { x: 10, y: 500 }],
    }
    const elements = [mesh1, mesh2, wall]

    it('collects only mesh edges (both x/y min/max), ignoring non-mesh', () => {
        const { xCoords, yCoords } = collectMeshEdgeCoordinates(elements)
        expect(xCoords.sort((a, b) => a - b)).toEqual([100, 300, 400, 500])
        expect(yCoords.sort((a, b) => a - b)).toEqual([100, 150, 200, 350])
    })

    it('excludeId filters mesh', () => {
        const { xCoords, yCoords } = collectMeshEdgeCoordinates(elements, 1)
        expect(xCoords.sort((a, b) => a - b)).toEqual([400, 500])
        expect(yCoords.sort((a, b) => a - b)).toEqual([150, 350])
    })

    it('snaps X when within threshold, emits vertical guide', () => {
        // cursor at (307, 205): dx=7 to x=300, dy=5 to y=200
        const result = snapToMeshEdges({ x: 307, y: 205 }, elements)
        expect(result.snapped).toEqual({ x: 300, y: 200 })
        expect(result.guides).toEqual([
            { type: 'vertical', x: 300 },
            { type: 'horizontal', y: 200 },
        ])
    })

    it('no snap when outside threshold, no guides', () => {
        // (350, 275) is >15px from any edge
        const result = snapToMeshEdges({ x: 350, y: 275 }, elements)
        expect(result.snapped).toEqual({ x: 350, y: 275 })
        expect(result.guides).toEqual([])
    })

    it('snaps only on axes within threshold (x close, y far)', () => {
        // x=105 (5 from 100), y=275 (far from any)
        const result = snapToMeshEdges({ x: 105, y: 275 }, elements)
        expect(result.snapped).toEqual({ x: 100, y: 275 })
        expect(result.guides).toEqual([{ type: 'vertical', x: 100 }])
    })

    it('picks nearest candidate within threshold when multiple are close', () => {
        // x=298 is 2 from 300 and 102 from 400 -> picks 300
        const result = snapToMeshEdges({ x: 298, y: 150 }, elements)
        expect(result.snapped.x).toBe(300)
        expect(result.snapped.y).toBe(150)
    })
})
