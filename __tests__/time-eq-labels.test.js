import { describe, it, expect } from 'vitest'
import { computeTimeEqLabels } from '../utils/timeEqLabels'

// Closed rectangle obstruction (matches how the canvas stores a drawn polygon)
const makeObstruction = (pts) => ({
    id: 'obs1',
    type: 'polyline',
    comments: 'obstruction',
    points: pts,
})

const makeOpening = (id, a, b) => ({
    id,
    type: 'polyline',
    comments: 'opening',
    points: [a, b],
})

const RECT = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
    { x: 0, y: 0 }, // closed
]

describe('computeTimeEqLabels - walls', () => {
    it('labels each segment of the first obstruction as Wall N at its midpoint', () => {
        const { walls } = computeTimeEqLabels([makeObstruction(RECT)])
        // 5 points (closed) => 4 wall segments, matching popup (finalPoints.length - 1)
        expect(walls.map((w) => w.text)).toEqual(['Wall 1', 'Wall 2', 'Wall 3', 'Wall 4'])
        expect(walls[0]).toMatchObject({ text: 'Wall 1', x: 50, y: 0 })
        expect(walls[1]).toMatchObject({ text: 'Wall 2', x: 100, y: 25 })
        expect(walls[2]).toMatchObject({ text: 'Wall 3', x: 50, y: 50 })
        expect(walls[3]).toMatchObject({ text: 'Wall 4', x: 0, y: 25 })
    })
})

describe('computeTimeEqLabels - openings', () => {
    it('labels each opening as Opening N at its midpoint, in array order', () => {
        const elements = [
            makeObstruction(RECT),
            makeOpening('op-a', { x: 20, y: 0 }, { x: 40, y: 0 }),
            makeOpening('op-b', { x: 100, y: 10 }, { x: 100, y: 30 }),
        ]
        const { openings } = computeTimeEqLabels(elements)
        expect(openings.map((o) => o.text)).toEqual(['Opening 1', 'Opening 2'])
        expect(openings[0]).toMatchObject({ text: 'Opening 1', x: 30, y: 0 })
        expect(openings[1]).toMatchObject({ text: 'Opening 2', x: 100, y: 20 })
    })
})

describe('computeTimeEqLabels - popup correspondence contract', () => {
    it('derives walls only from the first obstruction, ignoring later ones', () => {
        // Popup builds wall inputs from obstructions[0] only, so a second
        // obstruction must not add extra Wall labels.
        const triangle = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
        ] // 3 points => 2 segments
        const { walls } = computeTimeEqLabels([
            makeObstruction(RECT), // first: 4 walls
            { ...makeObstruction(triangle), id: 'obs2' },
        ])
        expect(walls.map((w) => w.text)).toEqual(['Wall 1', 'Wall 2', 'Wall 3', 'Wall 4'])
    })

    it('returns empty walls/openings when there are no relevant elements', () => {
        expect(computeTimeEqLabels([])).toEqual({ walls: [], openings: [] })
        const noObstruction = computeTimeEqLabels([makeOpening('op', { x: 0, y: 0 }, { x: 4, y: 0 })])
        expect(noObstruction.walls).toEqual([])
        expect(noObstruction.openings).toHaveLength(1)
    })
})
