import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// Auto-save is fdsGen-only. These tests lock in the invariant that the
// shared canvas store never reports "should save" while the user is working
// in radiation or timeEq mode — otherwise scratch geometry drawn in those
// modes would overwrite the loaded fdsGen project via the debounced auto-save.
describe('Store: auto-save mode guard', () => {
    beforeEach(() => {
        useStore.getState().setProjectId(null)
        useStore.getState().setCurrentMode('fdsGen')
    })

    it('does not auto-save when no project is loaded', () => {
        useStore.getState().setCurrentMode('fdsGen')
        useStore.getState().setProjectId(null)

        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('auto-saves in fdsGen mode with a project loaded', () => {
        useStore.getState().setProjectId('proj-1')
        useStore.getState().setCurrentMode('fdsGen')

        expect(useStore.getState().shouldAutoSave()).toBe(true)
    })

    it('does NOT auto-save in radiation mode even with a project loaded', () => {
        // Simulate: loaded an fdsGen project, then switched to radiation
        useStore.getState().setProjectId('proj-1')
        useStore.getState().setCurrentMode('radiation')

        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('does NOT auto-save in timeEq mode even with a project loaded', () => {
        useStore.getState().setProjectId('proj-1')
        useStore.getState().setCurrentMode('timeEq')

        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('does NOT auto-save in a mode that is not in the persistence registry', () => {
        // Guards against adding a new mode without registering it as DB-backed
        useStore.getState().setProjectId('proj-1')
        useStore.getState().setCurrentMode('someUnregisteredMode')

        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('resumes auto-saving when switching back to fdsGen', () => {
        useStore.getState().setProjectId('proj-1')

        useStore.getState().setCurrentMode('radiation')
        expect(useStore.getState().shouldAutoSave()).toBe(false)

        useStore.getState().setCurrentMode('fdsGen')
        expect(useStore.getState().shouldAutoSave()).toBe(true)
    })
})
