/** Integer element_index for POST /projects/{id}/save (backend ElementIn). */
export function toElementIndex(el, fallback = 0) {
    const candidates = [el?.element_index, el?.id, fallback]
    for (const c of candidates) {
        if (c === null || c === undefined || c === '') continue
        const n = Number(c)
        if (Number.isInteger(n)) return n
    }
    const fb = Number(fallback)
    return Number.isInteger(fb) ? fb : 0
}
