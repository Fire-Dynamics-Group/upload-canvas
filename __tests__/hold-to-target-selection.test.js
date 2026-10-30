import { describe, it, expect } from 'vitest'
import {
    selectionAfterPointerUp,
    shouldNudgeHeldVertex,
    canDeleteHeldSelection,
    shouldDropHoldOnPointerEvent,
} from '../utils/holdToTargetSelection'

const selected = { element: { id: 3, comments: 'obstruction' }, pointerDown: { x: 0, y: 0 } }

describe('click-to-select highlight; vertex follow stays hold-only', () => {
    it('keeps selection on pointer-up so Escape can delete after a normal click', () => {
        expect(selectionAfterPointerUp(selected)).toBe(selected)
        expect(selectionAfterPointerUp(null)).toBeNull()
    })

    it('does not drag a vertex after the button is released', () => {
        expect(shouldNudgeHeldVertex({ pointerHeld: false, buttons: 0 })).toBe(false)
        expect(shouldNudgeHeldVertex({ pointerHeld: true, buttons: 0 })).toBe(false)
        expect(shouldNudgeHeldVertex({ pointerHeld: true, buttons: 1 })).toBe(true)
    })

    it('deletes the highlighted wall after mouse-up', () => {
        expect(canDeleteHeldSelection({ selectedElement: selected, pointerHeld: true })).toBe(true)
        expect(canDeleteHeldSelection({ selectedElement: selected, pointerHeld: false })).toBe(true)
        expect(canDeleteHeldSelection({ selectedElement: null, pointerHeld: true })).toBe(false)
    })

    it('still deletes after pointercancel — Escape while held is not mouse-up', () => {
        expect(shouldDropHoldOnPointerEvent('pointercancel')).toBe(false)
        expect(shouldDropHoldOnPointerEvent('pointerup')).toBe(true)
        expect(canDeleteHeldSelection({
            selectedElement: null,
            holdTarget: selected,
            pointerHeld: false,
        })).toBe(true)
    })
})
