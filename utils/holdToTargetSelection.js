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

/**
 * Escape while holding often fires pointercancel (browser releases capture).
 * That is not mouse-up. Keep the hold target so Escape can still delete.
 */
export function shouldDropHoldOnPointerEvent(type) {
    return type === 'pointerup'
}

/** Escape/Delete the wall from this hold, even if pointercancel cleared pointerHeld. */
export function canDeleteHeldSelection({
    selectedElement = null,
    holdTarget = null,
    pointerHeld = false,
} = {}) {
    const target = (selectedElement && selectedElement.element) ? selectedElement : holdTarget
    return Boolean(target && target.element && (pointerHeld || holdTarget))
}
