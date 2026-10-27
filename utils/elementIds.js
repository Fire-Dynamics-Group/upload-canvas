/** Keys that remove the highlighted drawing (not only Escape). */
export function isElementDeleteKey(key) {
    return key === 'Delete' || key === 'Backspace' || key === 'Escape'
}

function numericId(value) {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isInteger(n) ? n : null
}

function isUsableId(value) {
    if (value === null || value === undefined || value === '') return false
    // NaN !== NaN, so it can never match a store key.
    return value === value
}

/** Next integer id, ignoring UUID / NaN leftovers from loaded floors. */
export function nextNumericElementId(elements) {
    let max = -1
    for (const el of elements || []) {
        const n = numericId(el?.id) ?? numericId(el?.element_index)
        if (n !== null && n > max) max = n
    }
    return max + 1
}

/** True if this element is the one the selection/delete path named. */
export function elementMatchesSelectionId(el, selectedID) {
    if (!el || !isUsableId(selectedID)) return false
    if (el.id === selectedID) return true
    if (el.element_index === selectedID) return true
    const selectedNum = numericId(selectedID)
    if (selectedNum === null) return false
    const liveNum = numericId(el.id)
    const indexNum = numericId(el.element_index)
    return selectedNum === liveNum || selectedNum === indexNum
}

/**
 * Delete the highlighted drawing, not "every wall without an element_index".
 * Object identity wins because loaded floors can leave live ids as UUID/NaN.
 */
export function elementIsHighlighted(el, selected) {
    if (!el || selected == null || selected !== selected) return false
    if (el === selected) return true
    if (typeof selected === 'object') {
        const target = selected.element ?? selected
        if (el === target) return true
        const id = selectionId(target)
        return isUsableId(id) && elementMatchesSelectionId(el, id)
    }
    return elementMatchesSelectionId(el, selected)
}

/**
 * Highlight is hold-to-target. Pointerup must not rewrite the wall for a
 * zero-offset click; WASD nudges still commit.
 */
export function shouldCommitSelectionNudge(offsetX, offsetY) {
    return Number(offsetX) !== 0 || Number(offsetY) !== 0
}

function selectionId(el) {
    if (!el) return undefined
    if (isUsableId(el.id)) return el.id
    if (isUsableId(el.element_index)) return el.element_index
    return undefined
}

/**
 * Hold-click highlight + Escape deletes that wall. Pointer-up drops the
 * highlight; Escape after release must not delete. The key handler reads
 * selection from a ref so Escape works before React rebinds the listener.
 * Backspace/Delete still yield when a text field is focused; Escape does not.
 */
export function canvasKeyAction({
    key,
    tool,
    showScalePopup = false,
    selectedElement = null,
    currentPoly = [],
    currentRect = [],
    typing = false,
    pointerHeld = false,
} = {}) {
    if (key === 'Escape' && tool === 'scale' && !showScalePopup) {
        return { type: 'restartScale' }
    }

    const hasSelection = !!(selectedElement && selectedElement.element)
    if (isElementDeleteKey(key) && hasSelection && pointerHeld) {
        if (typing && (key === 'Backspace' || key === 'Delete')) {
            return { type: 'none' }
        }
        return {
            type: 'deleteSelection',
            element: selectedElement.element,
            id: selectionId(selectedElement.element),
        }
    }

    if (key === 'Escape') {
        if (Array.isArray(currentPoly) && currentPoly.length > 0) {
            return { type: 'cancelPoly' }
        }
        if (Array.isArray(currentRect) && currentRect.length > 0) {
            return { type: 'cancelRect' }
        }
    }

    return { type: 'none' }
}
