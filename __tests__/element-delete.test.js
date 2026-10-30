import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'
import { isElementDeleteKey, elementMatchesSelectionId } from '../utils/elementIds'

const wall = (id, extra = {}) => ({
    id,
    type: 'polyline',
    comments: 'obstruction',
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    ...extra,
})

describe('isElementDeleteKey', () => {
    it('accepts Delete, Backspace, and Escape', () => {
        expect(isElementDeleteKey('Delete')).toBe(true)
        expect(isElementDeleteKey('Backspace')).toBe(true)
        expect(isElementDeleteKey('Escape')).toBe(true)
    })

    it('does not treat drawing modifiers as delete', () => {
        expect(isElementDeleteKey('Enter')).toBe(false)
        expect(isElementDeleteKey('d')).toBe(false)
        expect(isElementDeleteKey('Shift')).toBe(false)
    })
})

describe('elementMatchesSelectionId', () => {
    it('matches UUID id (Open Plan Test style)', () => {
        const el = wall('d97fec84-10e1-4f05-a63f-e5fa8b27e448', { element_index: 2 })
        expect(elementMatchesSelectionId(el, 'd97fec84-10e1-4f05-a63f-e5fa8b27e448')).toBe(true)
        expect(elementMatchesSelectionId(el, 2)).toBe(true)
    })

    it('matches integer id', () => {
        expect(elementMatchesSelectionId(wall(3), 3)).toBe(true)
        expect(elementMatchesSelectionId(wall(3), 4)).toBe(false)
    })
})

describe('removeElement deletes a highlighted obstruction', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
            elements: [],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
            elementsHistory: [],
            elementsFuture: [],
            floors: [],
        })
    })

    it('removes by UUID id', () => {
        const uuid = 'd97fec84-10e1-4f05-a63f-e5fa8b27e448'
        useStore.getState().addElement(wall(uuid, { element_index: 2 }))
        useStore.getState().removeElement(uuid)
        expect(useStore.getState().elements).toHaveLength(0)
    })

    it('removes by integer element_index when live id is still a UUID', () => {
        const uuid = 'd97fec84-10e1-4f05-a63f-e5fa8b27e448'
        useStore.getState().addElement(wall(uuid, { element_index: 2 }))
        useStore.getState().removeElement(2)
        expect(useStore.getState().elements).toHaveLength(0)
    })
})
