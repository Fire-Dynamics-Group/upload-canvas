import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// Undo/redo history over committed elements. addElement / removeElement /
// changeElement snapshot the prior elements so undo() can step back and redo()
// can step forward. Mode switches and project loads start a fresh history.

const reset = () =>
    useStore.setState({
        elements: [],
        elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
        currentMode: 'fdsGen',
        elementsHistory: [],
        elementsFuture: [],
    })

const el = (id) => ({ id, type: 'point', points: [{ x: id, y: id }], comments: 'fire' })

describe('Store: undo/redo history', () => {
    beforeEach(reset)

    it('undoes the last added element', () => {
        useStore.getState().addElement(el(0))
        expect(useStore.getState().elements).toHaveLength(1)
        useStore.getState().undo()
        expect(useStore.getState().elements).toHaveLength(0)
    })

    it('redo re-applies an undone add', () => {
        useStore.getState().addElement(el(0))
        useStore.getState().undo()
        expect(useStore.getState().elements).toHaveLength(0)
        useStore.getState().redo()
        expect(useStore.getState().elements).toHaveLength(1)
        expect(useStore.getState().elements[0].id).toBe(0)
    })

    it('steps back through multiple adds', () => {
        useStore.getState().addElement(el(0))
        useStore.getState().addElement(el(1))
        useStore.getState().undo()
        expect(useStore.getState().elements.map(e => e.id)).toEqual([0])
        useStore.getState().undo()
        expect(useStore.getState().elements).toHaveLength(0)
    })

    it('undo and redo are no-ops at the ends of the stacks', () => {
        expect(() => useStore.getState().undo()).not.toThrow()
        expect(useStore.getState().elements).toHaveLength(0)
        useStore.getState().addElement(el(0))
        expect(() => useStore.getState().redo()).not.toThrow() // nothing to redo
        expect(useStore.getState().elements).toHaveLength(1)
    })

    it('restores a removed element on undo', () => {
        useStore.getState().addElement(el(0))
        useStore.getState().removeElement(0)
        expect(useStore.getState().elements).toHaveLength(0)
        useStore.getState().undo()
        expect(useStore.getState().elements.map(e => e.id)).toEqual([0])
    })

    it('a new edit after an undo clears the redo stack', () => {
        useStore.getState().addElement(el(0))
        useStore.getState().addElement(el(1))
        useStore.getState().undo() // back to [0], redo would give [0,1]
        useStore.getState().addElement(el(2)) // new branch -> redo invalidated
        expect(useStore.getState().canRedo()).toBe(false)
        expect(useStore.getState().elements.map(e => e.id)).toEqual([0, 2])
    })

    it('keeps undo history scoped to the editing mode (cleared on mode switch)', () => {
        useStore.getState().addElement(el(0))
        useStore.getState().setCurrentMode('radiation')
        expect(useStore.getState().canUndo()).toBe(false)
        useStore.getState().undo() // must not reach back into fdsGen geometry
        expect(useStore.getState().elements).toHaveLength(0)
    })

    it('reports canUndo / canRedo', () => {
        expect(useStore.getState().canUndo()).toBe(false)
        useStore.getState().addElement(el(0))
        expect(useStore.getState().canUndo()).toBe(true)
        expect(useStore.getState().canRedo()).toBe(false)
        useStore.getState().undo()
        expect(useStore.getState().canRedo()).toBe(true)
    })
})
