import { describe, it, expect } from 'vitest'
import { collectSelectionCandidates } from '../Components/Canvas'

// Fixture helpers — shape mirrors what useStore actually stores.
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

describe('collectSelectionCandidates', () => {
    it('returns empty list when cursor is far from all elements', () => {
        const wall = makeWall(1, [{ x: 100, y: 100 }, { x: 200, y: 200 }])
        const result = collectSelectionCandidates({ x: 800, y: 800 }, [wall], 40)
        expect(result).toEqual([])
    })

    it('returns a single candidate when only one element is near the cursor', () => {
        const wall = makeWall(1, [{ x: 100, y: 100 }, { x: 200, y: 200 }])
        const result = collectSelectionCandidates({ x: 102, y: 101 }, [wall], 40)
        expect(result).toHaveLength(1)
        expect(result[0].element.id).toBe(1)
        expect(result[0].pointerDown).toEqual({ x: 100, y: 100 })
    })

    it('door (smaller bbox) wins over wall (larger bbox) when sharing a vertex', () => {
        const wall = makeWall(1, [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 500 },
        ])
        const door = makeDoor(2, { x: 500, y: 0 }, { x: 520, y: 0 })
        const result = collectSelectionCandidates({ x: 500, y: 0 }, [wall, door], 40)
        expect(result).toHaveLength(2)
        // door's bbox diagonal is smaller than wall's, so door ranks first
        expect(result[0].element.id).toBe(2)
        expect(result[1].element.id).toBe(1)
    })

    it('single point wins over door when sharing a location', () => {
        const door = makeDoor(1, { x: 100, y: 100 }, { x: 120, y: 100 })
        const point = makePoint(2, 100, 100)
        const result = collectSelectionCandidates({ x: 100, y: 100 }, [door, point], 40)
        expect(result).toHaveLength(2)
        expect(result[0].element.id).toBe(2) // point (0 diagonal) first
        expect(result[1].element.id).toBe(1)
    })

    it('sort is stable for identical distance+bbox ties (deterministic order)', () => {
        // Two identical-shape doors at the same location
        const d1 = makeDoor(1, { x: 100, y: 100 }, { x: 120, y: 100 })
        const d2 = makeDoor(2, { x: 100, y: 100 }, { x: 120, y: 100 })
        const r1 = collectSelectionCandidates({ x: 100, y: 100 }, [d1, d2], 40)
        const r2 = collectSelectionCandidates({ x: 100, y: 100 }, [d1, d2], 40)
        expect(r1.map(c => c.element.id)).toEqual(r2.map(c => c.element.id))
    })

    it('returns identical list order across repeated calls (cycling correctness)', () => {
        const wall = makeWall(1, [{ x: 0, y: 0 }, { x: 500, y: 0 }])
        const door = makeDoor(2, { x: 500, y: 0 }, { x: 520, y: 0 })
        const point = makePoint(3, 500, 0)
        const pointer = { x: 500, y: 0 }
        const calls = [
            collectSelectionCandidates(pointer, [wall, door, point], 40),
            collectSelectionCandidates(pointer, [wall, door, point], 40),
            collectSelectionCandidates(pointer, [wall, door, point], 40),
        ]
        const ids = calls.map(c => c.map(r => r.element.id))
        expect(ids[0]).toEqual(ids[1])
        expect(ids[1]).toEqual(ids[2])
    })

    it('uses expanded mesh corners when computing bbox diagonal for a rect', () => {
        // Rect stored as [topLeft, bottomRight]. The raw 2-point diagonal is
        // (0,0)->(300,200) = ~360. After expansion to 4 corners the bbox
        // diagonal is the same ~360 (it's the same rect). But the door's bbox
        // diagonal is ~20. Cursor on the shared corner means both candidates
        // within threshold, door should win because its bbox is smaller.
        const mesh = makeMesh(1, { x: 0, y: 0 }, { x: 300, y: 200 })
        const door = makeDoor(2, { x: 0, y: 0 }, { x: 20, y: 0 })
        const result = collectSelectionCandidates({ x: 0, y: 0 }, [mesh, door], 40)
        // Both should be present (cursor is on a mesh corner)
        expect(result).toHaveLength(2)
        expect(result[0].element.id).toBe(2) // door first
        expect(result[1].element.id).toBe(1)
        // Mesh candidate's pointerDown must be the corner the cursor is on
        const meshCandidate = result.find(c => c.element.id === 1)
        expect(meshCandidate.pointerDown).toEqual({ x: 0, y: 0 })
    })

    it('mesh is picked as a candidate when cursor is near a corner', () => {
        const mesh = makeMesh(1, { x: 100, y: 100 }, { x: 300, y: 200 })
        // Cursor near the bottom-right corner (300, 200)
        const result = collectSelectionCandidates({ x: 305, y: 202 }, [mesh], 40)
        expect(result).toHaveLength(1)
        expect(result[0].element.id).toBe(1)
        expect(result[0].pointerDown).toEqual({ x: 300, y: 200 })
    })

    it('respects the threshold — only returns candidates within range', () => {
        const wall = makeWall(1, [{ x: 100, y: 100 }, { x: 200, y: 200 }])
        const door = makeDoor(2, { x: 500, y: 500 }, { x: 520, y: 500 })
        const result = collectSelectionCandidates({ x: 100, y: 100 }, [wall, door], 40)
        expect(result).toHaveLength(1)
        expect(result[0].element.id).toBe(1)
    })

    it('closest vertex on a multi-vertex wall is the one returned as pointerDown', () => {
        const wall = makeWall(1, [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 500 },
        ])
        const result = collectSelectionCandidates({ x: 498, y: 2 }, [wall], 40)
        expect(result).toHaveLength(1)
        expect(result[0].pointerDown).toEqual({ x: 500, y: 0 })
    })
})
