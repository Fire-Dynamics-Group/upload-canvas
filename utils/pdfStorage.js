import { get, set, del, keys } from 'idb-keyval'

const PDF_KEY = 'project-pdf'

export function floorPdfIndexedDbKey(floorNumber) {
    return floorNumber == null || floorNumber === 0 ? PDF_KEY : `${PDF_KEY}-floor-${floorNumber}`
}

export async function savePdfToIndexedDB(arrayBuffer, floorNumber = 0) {
    try {
        await set(floorPdfIndexedDbKey(floorNumber), arrayBuffer)
    } catch (err) {
        console.warn('Failed to save PDF to IndexedDB:', err)
    }
}

export async function loadPdfFromIndexedDB(floorNumber = 0) {
    try {
        return await get(floorPdfIndexedDbKey(floorNumber)) || null
    } catch (err) {
        console.warn('Failed to load PDF from IndexedDB:', err)
        return null
    }
}

export async function clearPdfFromIndexedDB() {
    try {
        await del(PDF_KEY)
        const all = await keys()
        await Promise.all(
            (all || [])
                .filter((k) => typeof k === 'string' && k.startsWith(`${PDF_KEY}-floor-`))
                .map((k) => del(k))
        )
    } catch (err) {
        console.warn('Failed to clear PDF from IndexedDB:', err)
    }
}
