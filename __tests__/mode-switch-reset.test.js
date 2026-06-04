// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'

// The PDF and scale calibration (pdfData, pixelsPerMesh, canvasDimensions,
// convertedPoints, originPixels) are GLOBAL store fields, not per-mode buckets.
// Switching into a non-DB mode (radiation/timeEq) must NOT inherit them — those
// modes are ephemeral scratch and start from a fresh upload + scale step.
// Switching into DB-backed fdsGen must NOT reset (it re-hydrates from its
// project, and a reset here would let auto-save clobber it with defaults).
describe('setCurrentMode — non-DB modes start from a clean PDF + scale', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
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

    it('clears the shared PDF + scale when entering radiation', () => {
        useStore.getState().setCurrentMode('radiation')
        const s = useStore.getState()
        expect(s.currentMode).toBe('radiation')
        expect(s.pdfData).toBe(null)
        expect(s.pdfIsGreyscale).toBe(false)
        expect(s.pixelsPerMesh).toBe(1)
        expect(s.canvasDimensions).toEqual({})
        expect(s.convertedPoints).toEqual([])
        expect(s.originPixels).toBe(null)
        expect(s.hasDoor).toBe(false)
    })

    it('drops back into the scale tool so the next upload calibrates', () => {
        useStore.getState().setCurrentMode('timeEq')
        expect(useStore.getState().tool).toBe('scale')
    })

    it('still checks out the target mode geometry bucket', () => {
        useStore.setState({
            elementsByMode: { fdsGen: [], radiation: [{ id: 9 }], timeEq: [] },
        })
        useStore.getState().setCurrentMode('radiation')
        expect(useStore.getState().elements).toEqual([{ id: 9 }])
    })

    it('does NOT reset PDF + scale when entering DB-backed fdsGen', () => {
        useStore.setState({ currentMode: 'radiation' })
        useStore.getState().setCurrentMode('fdsGen')
        const s = useStore.getState()
        expect(s.currentMode).toBe('fdsGen')
        // fdsGen re-hydrates from its project; leave the shared state alone
        expect(s.pdfData).toEqual({ coloured: 'x', greyscaled: 'y' })
        expect(s.pixelsPerMesh).toBe(7)
        expect(s.canvasDimensions).toEqual({ width: 800, height: 600 })
    })

    it('is a no-op when re-selecting the current mode (keeps PDF + scale)', () => {
        useStore.setState({ currentMode: 'radiation' })
        useStore.getState().setCurrentMode('radiation')
        const s = useStore.getState()
        expect(s.pdfData).toEqual({ coloured: 'x', greyscaled: 'y' })
        expect(s.pixelsPerMesh).toBe(7)
    })
})
