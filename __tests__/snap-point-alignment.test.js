import { describe, it, expect } from 'vitest'
import {
    collectPointAlignmentCoordinates,
    snapToPointAlignment,
} from '../Components/Canvas'

const MESH_SNAP_THRESHOLD = 15

// Element fixture helpers -- shape mirrors what useStore actually stores.
const makeWall = (id, points) => ({
    id,
    type: 'polyline',
    comments: 'obstruction',
    points,
})

const makeDoor = (id, a, b) => ({
    id,
    type: 'polyline',
    comments: 'door',
    points: [a, b],
})

const makePoint = (id, x, y) => ({
    id,
    type: 'point',
    comments: 'fsaSensor',
    points: [{ x, y }],
})

const makeMesh = (id, tl, br) => ({
    id,
    type: 'rect',
    comments: 'mesh',
    points: [tl, br],
})

describe('collectPointAlignmentCoordinates', () => {
    it('collects wall polyline vertex x/y', () => {
        const wall = makeWall(1, [{ x: 100, y: 200 }, { x: 300, y: 400 }])
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([wall])
        expect(xCoords.sort((a, b) => a - b)).toEqual([100, 300])
        expect(yCoords.sort((a, b) => a - b)).toEqual([200, 400])
    })

    it('collects door polyline endpoints', () => {
        const door = makeDoor(1, { x: 50, y: 60 }, { x: 70, y: 80 })
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([door])
        expect(xCoords.sort((a, b) => a - b)).toEqual([50, 70])
        expect(yCoords.sort((a, b) => a - b)).toEqual([60, 80])
    })

    it('collects point element x/y', () => {
        const point = makePoint(1, 123, 456)
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([point])
        expect(xCoords).toContain(123)
        expect(yCoords).toContain(456)
    })

    it('collects all four mesh corner x/y', () => {
        const mesh = makeMesh(1, { x: 100, y: 100 }, { x: 300, y: 200 })
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([mesh])
        expect(xCoords.sort((a, b) => a - b)).toEqual([100, 100, 300, 300])
        expect(yCoords.sort((a, b) => a - b)).toEqual([100, 100, 200, 200])
    })

    it('respects excludeId', () => {
        const wall1 = makeWall(1, [{ x: 10, y: 10 }, { x: 20, y: 20 }])
        const wall2 = makeWall(2, [{ x: 100, y: 100 }, { x: 200, y: 200 }])
        const { xCoords } = collectPointAlignmentCoordinates([wall1, wall2], 1)
        expect(xCoords).not.toContain(10)
        expect(xCoords).not.toContain(20)
        expect(xCoords.sort((a, b) => a - b)).toEqual([100, 200])
    })

    it('appends inProgressPoints as candidates', () => {
        const inProgress = [{ x: 50, y: 60 }]
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([], null, inProgress)
        expect(xCoords).toContain(50)
        expect(yCoords).toContain(60)
    })

    it('returns empty coords when no candidates', () => {
        const { xCoords, yCoords } = collectPointAlignmentCoordinates([])
        expect(xCoords).toEqual([])
        expect(yCoords).toEqual([])
    })
})

describe('snapToPointAlignment', () => {
    it('snaps X within threshold and emits vertical guide', () => {
        // candidate x=100, cursor x=105 -> snap to 100
        const coords = { xCoords: [100], yCoords: [] }
        const result = snapToPointAlignment({ x: 105, y: 500 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.x).toBe(100)
        expect(result.snapped.y).toBe(500)
        expect(result.guides).toEqual([{ type: 'vertical', x: 100 }])
    })

    it('snaps Y within threshold and emits horizontal guide', () => {
        const coords = { xCoords: [], yCoords: [200] }
        const result = snapToPointAlignment({ x: 500, y: 210 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.y).toBe(200)
        expect(result.guides).toEqual([{ type: 'horizontal', y: 200 }])
    })

    it('snaps both axes independently', () => {
        const coords = { xCoords: [100], yCoords: [200] }
        const result = snapToPointAlignment({ x: 103, y: 198 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped).toEqual({ x: 100, y: 200 })
        expect(result.guides).toEqual([
            { type: 'vertical', x: 100 },
            { type: 'horizontal', y: 200 },
        ])
    })

    it('emits no guide when cursor is outside threshold', () => {
        const coords = { xCoords: [100], yCoords: [200] }
        const result = snapToPointAlignment({ x: 500, y: 500 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped).toEqual({ x: 500, y: 500 })
        expect(result.guides).toEqual([])
    })

    it('picks nearest candidate when multiple are in range', () => {
        const coords = { xCoords: [100, 110], yCoords: [] }
        const result = snapToPointAlignment({ x: 108, y: 0 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.x).toBe(110) // 2px vs 8px
    })
})

describe('integration: collect + snap together', () => {
    it('snaps cursor near existing wall endpoint X, Y falls through', () => {
        const wall = makeWall(1, [{ x: 100, y: 50 }, { x: 100, y: 200 }])
        const coords = collectPointAlignmentCoordinates([wall])
        const result = snapToPointAlignment({ x: 108, y: 800 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.x).toBe(100)
        expect(result.snapped.y).toBe(800) // no nearby Y candidate
        expect(result.guides).toEqual([{ type: 'vertical', x: 100 }])
    })

    it('door 2nd click aligns to door 1st click via inProgressPoints', () => {
        // No committed elements, but currentPoly has first click at x=250, y=300
        const inProgress = [{ x: 250, y: 300 }]
        const coords = collectPointAlignmentCoordinates([], null, inProgress)
        // Cursor 4px off the first click's X
        const result = snapToPointAlignment({ x: 254, y: 450 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.x).toBe(250)
        expect(result.guides).toContainEqual({ type: 'vertical', x: 250 })
    })

    it('polyline vertex 3 aligns to vertex 1 via inProgressPoints', () => {
        // currentPoly = [v1, v2], hovering v3 near v1's Y
        const inProgress = [{ x: 50, y: 100 }, { x: 200, y: 150 }]
        const coords = collectPointAlignmentCoordinates([], null, inProgress)
        // Cursor near v1 Y = 100
        const result = snapToPointAlignment({ x: 800, y: 102 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.y).toBe(100)
        expect(result.guides).toContainEqual({ type: 'horizontal', y: 100 })
    })

    it('mesh corner acts as a point candidate (not just edge)', () => {
        const mesh = makeMesh(1, { x: 100, y: 100 }, { x: 300, y: 200 })
        const coords = collectPointAlignmentCoordinates([mesh])
        // cursor near bottom-right corner (300, 200)
        const result = snapToPointAlignment({ x: 304, y: 203 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped).toEqual({ x: 300, y: 200 })
    })

    it('point element contributes a candidate', () => {
        const sensor = makePoint(1, 444, 555)
        const coords = collectPointAlignmentCoordinates([sensor])
        const result = snapToPointAlignment({ x: 446, y: 557 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped).toEqual({ x: 444, y: 555 })
    })

    it('cursor far from all candidates yields no snap, no guides', () => {
        const wall = makeWall(1, [{ x: 100, y: 100 }, { x: 200, y: 200 }])
        const coords = collectPointAlignmentCoordinates([wall])
        const result = snapToPointAlignment({ x: 800, y: 800 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped).toEqual({ x: 800, y: 800 })
        expect(result.guides).toEqual([])
    })

    it('excludeId filters element currently being drawn', () => {
        const wall1 = makeWall(1, [{ x: 100, y: 100 }, { x: 100, y: 200 }])
        const wall2 = makeWall(2, [{ x: 500, y: 500 }, { x: 600, y: 600 }])
        const coords = collectPointAlignmentCoordinates([wall1, wall2], 1)
        // Cursor near wall1 X=100 — should NOT snap (wall1 excluded)
        const result = snapToPointAlignment({ x: 102, y: 150 }, coords, MESH_SNAP_THRESHOLD)
        expect(result.snapped.x).toBe(102)
        expect(result.guides).toEqual([])
    })
})
