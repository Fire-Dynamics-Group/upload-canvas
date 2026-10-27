import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'
import {
    isElementDeleteKey,
    elementMatchesSelectionId,
    shouldCommitSelectionNudge,
    canvasKeyAction,
} from '../utils/elementIds'

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

describe('shouldCommitSelectionNudge', () => {
    it('does not rewrite a wall that was only clicked', () => {
        expect(shouldCommitSelectionNudge(0, 0)).toBe(false)
    })

    it('commits when WASD actually nudged the vertex', () => {
        expect(shouldCommitSelectionNudge(10, 0)).toBe(true)
        expect(shouldCommitSelectionNudge(0, -10)).toBe(true)
    })
})

describe('canvasKeyAction: Escape on a highlighted obstruction', () => {
    const selected = { element: wall(3), pointerDown: { x: 0, y: 0 } }

    it('deletes the highlighted wall on Escape after click-to-select', () => {
        expect(canvasKeyAction({
            key: 'Escape',
            tool: 'selection',
            selectedElement: selected,
        })).toEqual({ type: 'deleteSelection', id: 3 })
    })

    it('still deletes on Escape when a FloorBar input kept focus', () => {
        expect(canvasKeyAction({
            key: 'Escape',
            tool: 'selection',
            selectedElement: selected,
            typing: true,
        })).toEqual({ type: 'deleteSelection', id: 3 })
    })

    it('does not steal Backspace from a focused text field', () => {
        expect(canvasKeyAction({
            key: 'Backspace',
            tool: 'selection',
            selectedElement: selected,
            typing: true,
        })).toEqual({ type: 'none' })
    })

    it('cancels an in-progress obstruction if nothing is selected', () => {
        expect(canvasKeyAction({
            key: 'Escape',
            tool: 'polyline',
            currentPoly: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        })).toEqual({ type: 'cancelPoly' })
    })

    it('restarts scale calibration instead of deleting', () => {
        expect(canvasKeyAction({
            key: 'Escape',
            tool: 'scale',
            showScalePopup: false,
            selectedElement: selected,
        })).toEqual({ type: 'restartScale' })
    })
})
