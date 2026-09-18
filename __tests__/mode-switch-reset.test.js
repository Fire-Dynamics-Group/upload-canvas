// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// The PDF and scale calibration (pdfData, pixelsPerMesh, canvasDimensions,
// convertedPoints, originPixels) are GLOBAL store fields, not per-mode buckets,
// and a project belongs to exactly one mode. Switching mode therefore always:
//   - detaches the open project (projectId/floorId/projectName -> null), so the
//     debounced autosave can never write one mode's payload onto another
//     mode's project; and
//   - clears the shared PDF + scale, so the next mode starts from a fresh
//     upload (non-DB modes) or a fresh project selection (DB-backed modes,
//     which re-hydrate PDF + scale from the chosen project).
describe('setCurrentMode — every mode switch detaches the project and starts clean', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
            projectId: 'fds-1',
            floorId: 'floor-1',
            projectName: 'Tower',
            saveStatus: 'saved',
            elements: [],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [] },
            pdfData: { coloured: 'x', greyscaled: 'y' },
            pdfIsGreyscale: true,
            pixelsPerMesh: 7,
            canvasDimensions: { width: 800, height: 600 },
            convertedPoints: [{ x: 1, y: 2 }],
            originPixels: { x: 10, y: 20 },
            hasDoor: true,
            tool: 'obstruction',
        })
    })

    const expectClean = (s) => {
        expect(s.pdfData).toBe(null)
        expect(s.pdfIsGreyscale).toBe(false)
        expect(s.pixelsPerMesh).toBe(1)
        expect(s.canvasDimensions).toEqual({})
        expect(s.convertedPoints).toEqual([])
        expect(s.originPixels).toBe(null)
        expect(s.hasDoor).toBe(false)
        expect(s.tool).toBe('scale')
    }

    const expectDetached = (s) => {
        expect(s.projectId).toBe(null)
        expect(s.floorId).toBe(null)
        expect(s.projectName).toBe(null)
        expect(s.saveStatus).toBe(null)
    }

    it('clears the shared PDF + scale when entering radiation', () => {
        useStore.getState().setCurrentMode('radiation')
        const s = useStore.getState()
        expect(s.currentMode).toBe('radiation')
        expectClean(s)
    })

    it('drops back into the scale tool so the next upload calibrates', () => {
        useStore.getState().setCurrentMode('efs')
        expect(useStore.getState().tool).toBe('scale')
    })

    it('still checks out the target mode geometry bucket', () => {
        useStore.setState({
            elementsByMode: { fdsGen: [], radiation: [{ id: 9 }], timeEq: [] },
        })
        useStore.getState().setCurrentMode('radiation')
        expect(useStore.getState().elements).toEqual([{ id: 9 }])
    })

    it('detaches an fdsGen project when switching to DB-backed timeEq', () => {
        // Otherwise shouldAutoSave() would stay true and the first timeEq edit
        // would POST a timeEq payload onto the fdsGen project.
        useStore.getState().setCurrentMode('timeEq')
        const s = useStore.getState()
        expect(s.currentMode).toBe('timeEq')
        expectDetached(s)
        expectClean(s)
        expect(s.shouldAutoSave()).toBe(false)
    })

    it('detaches and resets when entering fdsGen from another mode too', () => {
        useStore.setState({ currentMode: 'timeEq', projectId: 'teq-1', floorId: 'f', projectName: 'TEQ' })
        useStore.getState().setCurrentMode('fdsGen')
        const s = useStore.getState()
        expect(s.currentMode).toBe('fdsGen')
        expectDetached(s)
        expectClean(s)
    })

    it('is a no-op when re-selecting the current mode (keeps project, PDF + scale)', () => {
        useStore.getState().setCurrentMode('fdsGen')
        const s = useStore.getState()
        expect(s.projectId).toBe('fds-1')
        expect(s.pdfData).toEqual({ coloured: 'x', greyscaled: 'y' })
        expect(s.pixelsPerMesh).toBe(7)
    })
})
