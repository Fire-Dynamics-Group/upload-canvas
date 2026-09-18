import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// Auto-save only fires for DB-backed modes (fdsGen, timeEq) with a project
// attached. These tests lock in the invariant that the shared canvas store
// never reports "should save" while the user is working in a scratch mode
// (radiation/efs), and that a mode switch detaches the project so one mode's
// autosave can never target another mode's project.
describe('Store: auto-save mode guard', () => {
    beforeEach(() => {
        useStore.setState({ currentMode: 'fdsGen', projectId: null, floorId: null, projectName: null })
    })

    it('does not auto-save when no project is loaded', () => {
        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('auto-saves in fdsGen mode with a project loaded', () => {
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(true)
    })

    it('auto-saves in timeEq mode with a timeEq project loaded', () => {
        useStore.getState().setCurrentMode('timeEq')
        useStore.getState().setProjectId('teq-1')
        expect(useStore.getState().shouldAutoSave()).toBe(true)
    })

    it('does NOT auto-save in radiation mode even if a project id is set', () => {
        useStore.getState().setCurrentMode('radiation')
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('does NOT auto-save in efs mode even if a project id is set', () => {
        useStore.getState().setCurrentMode('efs')
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('does NOT auto-save in a mode that is not in the persistence registry', () => {
        // Guards against adding a new mode without registering it as DB-backed
        useStore.getState().setCurrentMode('someUnregisteredMode')
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(false)
    })

    it('stops auto-saving after a mode switch until a project is picked again', () => {
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(true)

        // fdsGen -> timeEq: the fdsGen project is detached, not carried over
        useStore.getState().setCurrentMode('timeEq')
        expect(useStore.getState().projectId).toBe(null)
        expect(useStore.getState().shouldAutoSave()).toBe(false)

        // back to fdsGen: still detached until the dashboard hydrates a project
        useStore.getState().setCurrentMode('fdsGen')
        expect(useStore.getState().shouldAutoSave()).toBe(false)
        useStore.getState().setProjectId('proj-1')
        expect(useStore.getState().shouldAutoSave()).toBe(true)
    })
})
