/** True when this floor has a plan that should survive save/reload. */
export function floorHasPersistedPdf(floor) {
    if (!floor) return false
    if (floor.pdf_s3_key) return true
    if (floor.hasCustomPdf) return true
    if (floor.pdfSource === 'custom' || floor.pdfSource === 'ground') return true
    return false
}

export function pdfKeyFromUpload(uploaded, floorNumber) {
    return uploaded?.pdf_s3_key || uploaded?.s3_key || uploaded?.key || `uploaded_${floorNumber}`
}

/**
 * POST /save is delete-then-recreate. PDFs are stored per floor id, so a new
 * row loses the plan unless we re-upload. Return floors that need that rebind.
 */
export function floorsToRebindPdf(localFloors = [], serverFloors = []) {
    const byNumber = Object.fromEntries(
        (serverFloors || []).map((sf) => [sf.floor_number, sf])
    )
    const rebind = []
    for (let index = 0; index < (localFloors || []).length; index += 1) {
        const local = localFloors[index]
        if (!floorHasPersistedPdf(local)) continue
        const server = byNumber[local.floor_number]
        if (!server?.id) continue
        const idChanged = Boolean(local.id && server.id && local.id !== server.id)
        const serverLostKey = !server.pdf_s3_key
        if (!idChanged && !serverLostKey) continue
        rebind.push({
            floorNumber: local.floor_number,
            floorIndex: index,
            floorId: server.id,
            pdfSource: local.pdfSource || (local.pdf_s3_key ? 'custom' : null),
        })
    }
    return rebind
}
