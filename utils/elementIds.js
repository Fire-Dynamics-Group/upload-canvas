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
