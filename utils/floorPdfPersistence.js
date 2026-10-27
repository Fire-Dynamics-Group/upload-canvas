/** Placeholder the client used to store after upload instead of the real S3 key. */
export function isPlaceholderPdfKey(key) {
    return typeof key === 'string' && /^uploaded_\d+$/.test(key)
}

/** True when this floor has a plan that should survive save/reload. */
export function floorHasPersistedPdf(floor) {
    if (!floor) return false
    if (payloadPdfS3Key(floor)) return true
    if (floor.hasCustomPdf) return true
    if (floor.pdfSource === 'custom' || floor.pdfSource === 'ground') return true
    if (floor.settings?.hasCustomPdf) return true
    if (floor.settings?.pdfSource === 'custom' || floor.settings?.pdfSource === 'ground') return true
    return false
}

/** Real MinIO key from POST /floors/{id}/pdf, or null (never invent uploaded_N). */
export function pdfKeyFromUpload(uploaded) {
    const key = uploaded?.pdf_s3_key || uploaded?.s3_key || uploaded?.key
    if (!key || isPlaceholderPdfKey(key)) return null
    return key
}

/** Value to send on FloorSavePayload.pdf_s3_key. Backend ignores unknown fields today. */
export function payloadPdfS3Key(floor) {
    const key = floor?.pdf_s3_key
    if (!key || isPlaceholderPdfKey(key)) return null
    return key
}

export function floorPdfSettingsPatch(floor) {
    if (!floorHasPersistedPdf(floor)) return {}
    return {
        hasCustomPdf: true,
        pdfSource: floor.pdfSource || floor.settings?.pdfSource || (payloadPdfS3Key(floor) ? 'custom' : null),
    }
}

/**
 * Restore order for an upper-floor plan after switch/reload:
 * in-memory cache, then IndexedDB, then S3. Save may mint a new floor id,
 * so the S3 object on the previous id 404s even when bytes are still local.
 */
export function chooseFloorPdfRestoreSource({ hasCache, hasIndexedDb, canFetchS3 }) {
    if (hasCache) return 'cache'
    if (hasIndexedDb) return 'indexeddb'
    if (canFetchS3) return 's3'
    return 'blank'
}

/**
 * POST /save used to delete-then-recreate floor rows (and a first save of
 * Level 1 still inserts a new row with pdf_s3_key=null). PDFs live per floor
 * id, so return floors that need a re-upload from IndexedDB onto the new id.
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
        // GET /pdf signs whatever key is stored on the row. If the server kept
        // a key (even after an id change that copied it), the object is still
        // fetchable. Only re-upload when the row has no key.
        if (server.pdf_s3_key) continue
        rebind.push({
            floorNumber: local.floor_number,
            floorIndex: index,
            floorId: server.id,
            pdfSource: local.pdfSource || local.settings?.pdfSource || (payloadPdfS3Key(local) ? 'custom' : null),
        })
    }
    return rebind
}
