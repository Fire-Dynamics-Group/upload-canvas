/**
 * Highlight is hold-to-target. These helpers exist so a regression that
 * leaves the wall selected after mouse-up fails in unit tests, not in the
 * user's hand.
 */

/** Pointer-up always drops the highlight. Never persist click-to-select. */
export function selectionAfterPointerUp() {
    return null
}

/** Vertex follow / guide-line nudge only while the button is still down. */
export function shouldNudgeHeldVertex({ pointerHeld = false, buttons = 0 } = {}) {
    return Boolean(pointerHeld && (buttons & 1))
}

/** Escape/Delete only remove the wall that is currently held. */
export function canDeleteHeldSelection({ selectedElement = null, pointerHeld = false } = {}) {
    return Boolean(pointerHeld && selectedElement && selectedElement.element)
}
