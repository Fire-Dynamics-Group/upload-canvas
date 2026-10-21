import { get, set, del } from 'idb-keyval'

const PDF_KEY = 'project-pdf'
const floorKey = (floorNumber) =>
    floorNumber == null || floorNumber === 0 ? PDF_KEY : `${PDF_KEY}-floor-${floorNumber}`

export async function savePdfToIndexedDB(arrayBuffer, floorNumber = 0) {
    try {
        await set(floorKey(floorNumber), arrayBuffer)
    } catch (err) {
        console.warn('Failed to save PDF to IndexedDB:', err)
    }
}

export async function loadPdfFromIndexedDB(floorNumber = 0) {
    try {
        return await get(floorKey(floorNumber)) || null
    } catch (err) {
        console.warn('Failed to load PDF from IndexedDB:', err)
        return null
    }
}

export async function clearPdfFromIndexedDB() {
    try {
        await del(PDF_KEY)
    } catch (err) {
        console.warn('Failed to clear PDF from IndexedDB:', err)
    }
}
