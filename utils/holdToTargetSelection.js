/**
 * Click keeps the highlight so Escape/Delete can remove the wall after
 * mouse-up. Vertex follow is gated on pointerHeld, not on selection.
 */

/** Pointer-up keeps the current highlight. Pass null only when the wall is gone. */
export function selectionAfterPointerUp(current = null) {
    return current ?? null
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

/** Escape/Delete the highlighted wall, including after mouse-up or pointercancel. */
export function canDeleteHeldSelection({
    selectedElement = null,
    holdTarget = null,
    pointerHeld = false,
} = {}) {
    const target = (selectedElement && selectedElement.element) ? selectedElement : holdTarget
    return Boolean(target && target.element)
}
