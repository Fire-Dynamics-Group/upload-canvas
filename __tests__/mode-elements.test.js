import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'
import { collectSelectionCandidates } from '../Components/Canvas'
import {
    isCommentAllowedForMode,
    isElementAllowedForMode,
    sanitizeCommentForMode,
    sanitizeToolForMode,
} from '../utils/modeElements'

describe('mode element and tool safety guards', () => {
    beforeEach(() => {
        useStore.setState({
            currentMode: 'fdsGen',
            tool: 'scale',
            comment: '',
            elements: [],
            elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
            elementsHistory: [],
            elementsFuture: [],
        })
    })

    it('only allows mode-specific comments and tools', () => {
        expect(isCommentAllowedForMode('efs', 'efsWall')).toBe(true)
        expect(isCommentAllowedForMode('efs', 'efsBoundary')).toBe(true)
        expect(isCommentAllowedForMode('efs', 'obstruction')).toBe(false)
        expect(isElementAllowedForMode('efs', { comments: 'obstruction' })).toBe(false)
        expect(isElementAllowedForMode('timeEq', { comments: 'opening' })).toBe(true)
        expect(isElementAllowedForMode('timeEq', { comments: 'efsWall' })).toBe(false)
        expect(sanitizeCommentForMode('efs', 'obstruction')).toBe('')
        expect(sanitizeToolForMode('efs', 'rect')).toBe('selection')
        expect(sanitizeToolForMode('efs', 'efsBay')).toBe('efsBay')
    })

    it('prevents setComment, setTool, and addElement from using non-mode types in efs', () => {
        useStore.getState().setCurrentMode('efs')

        useStore.getState().setComment('obstruction')
        expect(useStore.getState().comment).toBe('')

        useStore.getState().setTool('rect')
        expect(useStore.getState().tool).toBe('selection')

        useStore.getState().addElement({ id: 1, type: 'polyline', points: [{ x: 0, y: 0 }], comments: 'obstruction' })
        expect(useStore.getState().elements).toHaveLength(0)

        useStore.getState().setTool('polyline')
        useStore.getState().setComment('efsWall')
        useStore.getState().addElement({ id: 2, type: 'polyline', points: [{ x: 0, y: 0 }], comments: 'efsWall' })
        expect(useStore.getState().comment).toBe('efsWall')
        expect(useStore.getState().elements).toHaveLength(1)
    })

    it('filters out non-mode elements in collectSelectionCandidates when currentMode is provided', () => {
        const elements = [
            { id: 1, type: 'polyline', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], comments: 'obstruction' },
            { id: 2, type: 'polyline', points: [{ x: 12, y: 12 }, { x: 30, y: 12 }], comments: 'efsWall' },
        ]
        const candidates = collectSelectionCandidates({ x: 11, y: 11 }, elements, 40, 'efs')
        expect(candidates).toHaveLength(1)
        expect(candidates[0].element.id).toBe(2)
    })
})
