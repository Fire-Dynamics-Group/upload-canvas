// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { findMisclassifiedObstructions, convertToStairObstruction } from '../utils/stairMeshValidation'
import useStore from '../store/useStore'

describe('findMisclassifiedObstructions', () => {
    it('flags a normal obstruction whose polyline overlaps a stair mesh', () => {
        const stairMesh = {
            id: 1,
            type: 'rect',
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            comments: 'stairMesh',
        }
        const obstruction = {
            id: 2,
            type: 'polyline',
            points: [{ x: 20, y: 20 }, { x: 80, y: 80 }],
            comments: 'obstruction',
        }

        const flagged = findMisclassifiedObstructions([stairMesh, obstruction])

        expect(flagged.map((el) => el.id)).toEqual([2])
    })

    it('does not flag an obstruction drawn outside every stair mesh', () => {
        const stairMesh = {
            id: 1,
            type: 'rect',
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            comments: 'stairMesh',
        }
        const obstruction = {
            id: 2,
            type: 'polyline',
            points: [{ x: 200, y: 200 }, { x: 260, y: 260 }],
            comments: 'obstruction',
        }

        const flagged = findMisclassifiedObstructions([stairMesh, obstruction])

        expect(flagged).toEqual([])
    })

    it('does not flag a stairObstruction already inside the stair mesh', () => {
        const stairMesh = {
            id: 1,
            type: 'rect',
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            comments: 'stairMesh',
        }
        const stairObstruction = {
            id: 2,
            type: 'polyline',
            points: [{ x: 20, y: 20 }, { x: 80, y: 80 }],
            comments: 'stairObstruction',
        }

        const flagged = findMisclassifiedObstructions([stairMesh, stairObstruction])

        expect(flagged).toEqual([])
    })

    it('flags nothing when there is no stair mesh', () => {
        const obstruction = {
            id: 2,
            type: 'polyline',
            points: [{ x: 20, y: 20 }, { x: 80, y: 80 }],
            comments: 'obstruction',
        }

        const flagged = findMisclassifiedObstructions([obstruction])

        expect(flagged).toEqual([])
    })

    it('flags an obstruction that crosses the mesh with no vertex inside it', () => {
        const stairMesh = {
            id: 1,
            type: 'rect',
            points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            comments: 'stairMesh',
        }
        // Horizontal line passing straight through the mesh; both endpoints
        // are outside the x-range, so neither vertex is inside the rect.
        const obstruction = {
            id: 2,
            type: 'polyline',
            points: [{ x: -50, y: 50 }, { x: 150, y: 50 }],
            comments: 'obstruction',
        }

        const flagged = findMisclassifiedObstructions([stairMesh, obstruction])

        expect(flagged.map((el) => el.id)).toEqual([2])
    })
})

describe('convertToStairObstruction', () => {
    it('flips only the given elements to stairObstruction and leaves others untouched', () => {
        const elements = [
            { id: 1, type: 'rect', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], comments: 'stairMesh' },
            { id: 2, type: 'polyline', points: [{ x: 20, y: 20 }, { x: 80, y: 80 }], comments: 'obstruction' },
            { id: 3, type: 'polyline', points: [{ x: 200, y: 200 }, { x: 260, y: 260 }], comments: 'obstruction' },
        ]

        const result = convertToStairObstruction(elements, [elements[1]])

        expect(result.find((el) => el.id === 2).comments).toBe('stairObstruction')
        expect(result.find((el) => el.id === 3).comments).toBe('obstruction')
        expect(result.find((el) => el.id === 1).comments).toBe('stairMesh')
    })

    it('does not mutate the input array or elements', () => {
        const elements = [
            { id: 2, type: 'polyline', points: [{ x: 20, y: 20 }], comments: 'obstruction' },
        ]

        convertToStairObstruction(elements, [elements[0]])

        expect(elements[0].comments).toBe('obstruction')
    })

    it('does not over-convert obstructions that share an id with a target', () => {
        const inside = { id: 7, type: 'polyline', points: [{ x: 20, y: 20 }], comments: 'obstruction' }
        const farWall = { id: 7, type: 'polyline', points: [{ x: 999, y: 999 }], comments: 'obstruction' }
        const elements = [inside, farWall]

        const result = convertToStairObstruction(elements, [inside])

        // Reference-based matching: the far wall keeps its type despite the shared id.
        expect(result[0].comments).toBe('stairObstruction')
        expect(result[1].comments).toBe('obstruction')
    })
})

describe('store: convertObstructionsToStair', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
            elements: [],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
            elementsHistory: [],
            elementsFuture: [],
        })
    })

    it('reclassifies the obstructions inside a stair mesh and the change is undoable', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], comments: 'stairMesh' })
        store().addElement({ id: 2, type: 'polyline', points: [{ x: 20, y: 20 }, { x: 80, y: 80 }], comments: 'obstruction' })

        store().convertObstructionsToStair()

        expect(store().elements.find((el) => el.id === 2).comments).toBe('stairObstruction')

        store().undo()

        expect(store().elements.find((el) => el.id === 2).comments).toBe('obstruction')
    })

    it('leaves obstructions outside the stair mesh alone, even with a shared id', () => {
        useStore.setState({
            currentMode: 'fdsGen',
            elements: [
                { id: 1, type: 'rect', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], comments: 'stairMesh' },
                { id: 5, type: 'polyline', points: [{ x: 20, y: 20 }, { x: 80, y: 80 }], comments: 'obstruction' }, // inside
                { id: 5, type: 'polyline', points: [{ x: 500, y: 500 }, { x: 560, y: 560 }], comments: 'obstruction' }, // far wall, same id
            ],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
            elementsHistory: [],
            elementsFuture: [],
        })

        useStore.getState().convertObstructionsToStair()

        const converted = useStore.getState().elements.filter((el) => el.comments === 'stairObstruction')
        const stillNormal = useStore.getState().elements.filter((el) => el.comments === 'obstruction')
        expect(converted).toHaveLength(1)
        expect(stillNormal).toHaveLength(1)
    })
})
