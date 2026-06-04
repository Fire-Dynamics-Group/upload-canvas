import { get, set, del } from 'idb-keyval'

const PDF_KEY = 'project-pdf'

export async function savePdfToIndexedDB(arrayBuffer) {
    try {
        await set(PDF_KEY, arrayBuffer)
    } catch (err) {
        console.warn('Failed to save PDF to IndexedDB:', err)
    }
}

export async function loadPdfFromIndexedDB() {
    try {
        return await get(PDF_KEY) || null
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
