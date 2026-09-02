// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// The store's buildSavePayload / hydrateFromServer dispatch through the
// per-mode registry. DB-backed modes get their handler; others are inert.
describe('store persistence dispatch', () => {
    beforeEach(() => {
        useStore.getState().resetProject()
        useStore.getState().setCurrentMode('fdsGen')
    })

    it('builds a payload via the fdsGen handler in fdsGen mode', () => {
        useStore.getState().setProjectName('Tower')
        const payload = useStore.getState().buildSavePayload()
        expect(payload).not.toBeNull()
        expect(payload.name).toBe('Tower')
        expect(payload.floors).toHaveLength(1)
    })

    it('returns null when the active mode has no persistence handler', () => {
        useStore.getState().setCurrentMode('radiation')
        expect(useStore.getState().buildSavePayload()).toBeNull()
    })

    it('hydrates in fdsGen mode', () => {
        useStore.getState().hydrateFromServer(
            { id: 'p1', name: 'Loaded', settings: {} },
            { id: 'f1', settings: {}, elements: [] }
        )
        expect(useStore.getState().projectId).toBe('p1')
        expect(useStore.getState().projectName).toBe('Loaded')
    })

    it('is a no-op when hydrating a mode with no handler', () => {
        useStore.getState().setCurrentMode('radiation')
        useStore.getState().hydrateFromServer(
            { id: 'p9', name: 'X', settings: {} },
            { id: 'f9', settings: {}, elements: [] }
        )
        expect(useStore.getState().projectId).toBe(null)
    })

    it('builds a timeEq payload and hydrates in timeEq mode', () => {
        useStore.getState().setCurrentMode('timeEq')
        useStore.getState().hydrateFromServer(
            { id: 'p2', name: 'TEQ', mode: 'timeEq', settings: { timeEqInputs: { use: 'Hotel' }, timeEqResult: null } },
            { id: 'f2', settings: {}, pixels_per_mesh: 5, elements: [
                { element_index: 0, type: 'line', points: [{ x: 0, y: 0 }], comments: 'opening' },
            ] }
        )
        const s = useStore.getState()
        expect(s.projectId).toBe('p2')
        expect(s.floorId).toBe('f2')
        expect(s.timeEqInputs).toEqual({ use: 'Hotel' })
        expect(s.elements).toEqual([{ id: 0, type: 'line', points: [{ x: 0, y: 0 }], comments: 'opening' }])
        expect(s.elementsByMode.timeEq).toEqual(s.elements)

        const payload = s.buildSavePayload()
        expect(payload.name).toBe('TEQ')
        expect(payload.settings.timeEqInputs).toEqual({ use: 'Hotel' })
        expect(payload.floors[0].pixels_per_mesh).toBe(5)
        expect(payload.floors[0].elements).toHaveLength(1)
    })
})
