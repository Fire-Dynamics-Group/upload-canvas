// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// Phase 2: each mode owns its own geometry bucket over a shared PDF + scale.
// Switching modes "checks out" that mode's bucket into the live `elements`
// array, so one mode's shapes can never appear in or overwrite another's.
describe('per-mode geometry isolation', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
            elements: [],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [] },
        })
    })

    it('starts each mode with an empty bucket', () => {
        expect(useStore.getState().elementsByMode).toEqual({
            fdsGen: [], radiation: [], timeEq: [],
        })
    })

    it('stashes the current mode geometry and checks out the new mode on switch', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })

        store().setCurrentMode('radiation')

        // radiation bucket is empty -> live elements is empty
        expect(store().elements).toEqual([])
        // fdsGen geometry was stashed, not lost
        expect(store().elementsByMode.fdsGen).toEqual([
            { id: 1, type: 'rect', comments: 'mesh', points: [] },
        ])
    })

    it('restores a mode geometry intact when switching back', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })

        store().setCurrentMode('radiation')
        store().addElement({ id: 9, type: 'polyline', comments: 'escapeRoute', points: [] })

        store().setCurrentMode('fdsGen')

        expect(store().elements).toEqual([
            { id: 1, type: 'rect', comments: 'mesh', points: [] },
        ])
        expect(store().elementsByMode.radiation).toEqual([
            { id: 9, type: 'polyline', comments: 'escapeRoute', points: [] },
        ])
    })

    it('does not let an edit in one mode mutate another mode bucket', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })

        store().setCurrentMode('radiation')
        store().addElement({ id: 9, type: 'polyline', comments: 'escapeRoute', points: [] })
        store().removeElement(9)

        store().setCurrentMode('fdsGen')
        expect(store().elements).toEqual([
            { id: 1, type: 'rect', comments: 'mesh', points: [] },
        ])
    })

    it('treats setCurrentMode(sameMode) as a no-op that keeps live elements', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })

        store().setCurrentMode('fdsGen')

        expect(store().elements).toEqual([
            { id: 1, type: 'rect', comments: 'mesh', points: [] },
        ])
    })

    it('keeps the active mode bucket in sync with live elements (no switch needed)', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })
        store().addElement({ id: 2, type: 'rect', comments: 'mesh', points: [] })
        store().removeElement(1)

        // Source of truth is the bucket; it must mirror live elements immediately
        expect(store().elementsByMode.fdsGen).toEqual(store().elements)
        expect(store().elementsByMode.fdsGen).toEqual([
            { id: 2, type: 'rect', comments: 'mesh', points: [] },
        ])
    })

    it('resetProject clears all three buckets and live elements', () => {
        const store = useStore.getState
        store().addElement({ id: 1, type: 'rect', comments: 'mesh', points: [] })

        store().resetProject()

        expect(store().elements).toEqual([])
        expect(store().elementsByMode).toEqual({
            fdsGen: [], radiation: [], timeEq: [],
        })
    })
})
