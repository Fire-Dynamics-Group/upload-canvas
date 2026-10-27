import { describe, it, expect } from 'vitest'
import {
    selectionAfterPointerUp,
    shouldNudgeHeldVertex,
    canDeleteHeldSelection,
} from '../utils/holdToTargetSelection'

const selected = { element: { id: 3, comments: 'obstruction' }, pointerDown: { x: 0, y: 0 } }

describe('hold-to-target highlight (must fail if click-to-select comes back)', () => {
    it('clears selection on pointer-up so the vertex cannot follow the mouse', () => {
        expect(selectionAfterPointerUp()).toBeNull()
    })

    it('does not drag a vertex after the button is released', () => {
        expect(shouldNudgeHeldVertex({ pointerHeld: false, buttons: 0 })).toBe(false)
        expect(shouldNudgeHeldVertex({ pointerHeld: true, buttons: 0 })).toBe(false)
        expect(shouldNudgeHeldVertex({ pointerHeld: true, buttons: 1 })).toBe(true)
    })

    it('deletes only while the click is held', () => {
        expect(canDeleteHeldSelection({ selectedElement: selected, pointerHeld: true })).toBe(true)
        expect(canDeleteHeldSelection({ selectedElement: selected, pointerHeld: false })).toBe(false)
        expect(canDeleteHeldSelection({ selectedElement: null, pointerHeld: true })).toBe(false)
    })
})
