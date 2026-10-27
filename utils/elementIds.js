/** Keys that remove the highlighted drawing (not only Escape). */
export function isElementDeleteKey(key) {
    return key === 'Delete' || key === 'Backspace' || key === 'Escape'
}

function numericId(value) {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isInteger(n) ? n : null
}

/** True if this element is the one the selection/delete path named. */
export function elementMatchesSelectionId(el, selectedID) {
    if (!el) return false
    if (el.id === selectedID) return true
    if (el.element_index === selectedID) return true
    const selectedNum = numericId(selectedID)
    if (selectedNum === null) return false
    const liveNum = numericId(el.id)
    const indexNum = numericId(el.element_index)
    return selectedNum === liveNum || selectedNum === indexNum
}

/**
 * Click-to-highlight used to commit a zero-offset move and clear selection on
 * pointerup, so Escape had nothing left to delete. Only write the element when
 * a nudge actually moved it.
 */
export function shouldCommitSelectionNudge(offsetX, offsetY) {
    return Number(offsetX) !== 0 || Number(offsetY) !== 0
}

function selectionId(el) {
    if (!el) return undefined
    // NaN is not a usable store key (NaN !== NaN), so fall back to element_index.
    if (el.id !== undefined && el.id !== null && el.id !== '' && el.id === el.id) {
        return el.id
    }
    return el.element_index
}

/**
 * What a canvas keydown should do. Highlighted drawings stay selected after
 * the click (pointerup no longer clears them), so Escape can remove them.
 * Backspace/Delete still yield when a text field is focused; Escape does not,
 * because FloorBar number inputs keep focus after a canvas click.
 */
export function canvasKeyAction({
    key,
    tool,
    showScalePopup = false,
    selectedElement = null,
    currentPoly = [],
    currentRect = [],
    typing = false,
} = {}) {
    if (key === 'Escape' && tool === 'scale' && !showScalePopup) {
        return { type: 'restartScale' }
    }

    const hasSelection = !!(selectedElement && selectedElement.element)
    if (isElementDeleteKey(key) && hasSelection) {
        if (typing && (key === 'Backspace' || key === 'Delete')) {
            return { type: 'none' }
        }
        return { type: 'deleteSelection', id: selectionId(selectedElement.element) }
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
