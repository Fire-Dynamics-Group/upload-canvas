import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const SHOT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/level-1-pdf-persist'

test.use({ viewport: { width: 1440, height: 900 } })

type FloorRow = {
    id: string
    floor_number: number
    name: string | null
    pdf_s3_key: string | null
    settings: Record<string, unknown>
    elements: unknown[]
    canvas_dimensions?: unknown
    pixels_per_mesh?: number
    origin_pixels?: unknown
}

/**
 * Mock POST /save as delete-then-recreate: new floor ids, pdf_s3_key dropped.
 * PDFs are stored per floor id, so Level 1 only survives if the client
 * re-uploads from IndexedDB onto the new id.
 */
async function installRecreatingSaveBackend(page: import('@playwright/test').Page) {
    const fixturePdf = readFileSync(FIXTURE)
    const project = {
        id: 'proj-level-1-pdf',
        name: 'Level 1 PDF persist',
        mode: 'fdsGen',
        settings: {} as Record<string, unknown>,
        floors: [] as FloorRow[],
        created_by: 'Canvas',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
    const pdfByFloorId = new Map<string, Buffer>()
    const pdfUploads: string[] = []
    let floorSeq = 0
    let created = false

    const detail = () => ({
        id: project.id,
        name: project.name,
        mode: project.mode,
        settings: project.settings,
        created_by: project.created_by,
        created_at: project.created_at,
        updated_at: project.updated_at,
        floors: project.floors.map((f) => ({
            id: f.id,
            floor_number: f.floor_number,
            name: f.name,
            pdf_s3_key: f.pdf_s3_key,
        })),
    })

    await page.route('https://pdf.test/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            body: fixturePdf,
        })
    })

    await page.route('**/projects**', async (route) => {
        const req = route.request()
        const method = req.method()
        const url = new URL(req.url())
        const parts = url.pathname.split('/').filter(Boolean)

        if (method === 'GET' && parts.length === 1) {
            await route.fulfill({ json: created ? [detail()] : [] })
            return
        }

        if (method === 'POST' && parts.length === 1) {
            created = true
            const body = req.postDataJSON() as { name?: string }
            if (body?.name) project.name = body.name
            await route.fulfill({ status: 201, json: { id: project.id, name: project.name, mode: project.mode } })
            return
        }

        if (method === 'GET' && parts.length === 2 && parts[1] === project.id) {
            await route.fulfill({ json: detail() })
            return
        }

        if (method === 'POST' && parts[2] === 'save') {
            const body = req.postDataJSON() as {
                name?: string
                settings?: Record<string, unknown>
                floors?: Array<Record<string, unknown>>
            }
            if (body?.name) project.name = body.name
            if (body?.settings) project.settings = body.settings
            project.floors = (body.floors || []).map((fp) => {
                const id = `floor-${++floorSeq}`
                return {
                    id,
                    floor_number: Number(fp.floor_number),
                    name: (fp.name as string) || null,
                    pdf_s3_key: null,
                    settings: (fp.settings as Record<string, unknown>) || {},
                    elements: (fp.elements as unknown[]) || [],
                    canvas_dimensions: fp.canvas_dimensions,
                    pixels_per_mesh: Number(fp.pixels_per_mesh) || 1,
                    origin_pixels: fp.origin_pixels,
                }
            })
            project.updated_at = new Date().toISOString()
            await route.fulfill({ json: detail() })
            return
        }

        if (parts[2] === 'floors' && parts.length >= 4) {
            const floorId = parts[3]
            const floor = project.floors.find((f) => f.id === floorId)
            if (parts[4] === 'pdf' && method === 'POST') {
                if (!floor) {
                    await route.fulfill({ status: 404, json: { detail: 'Floor not found' } })
                    return
                }
                const key = `projects/${project.id}/floors/${floorId}/plan.pdf`
                floor.pdf_s3_key = key
                pdfByFloorId.set(floorId, fixturePdf)
                pdfUploads.push(floorId)
                await route.fulfill({ json: { pdf_s3_key: key } })
                return
            }
            if (parts[4] === 'pdf' && method === 'GET') {
                if (!floor?.pdf_s3_key || !pdfByFloorId.has(floorId)) {
                    await route.fulfill({ status: 404, json: { detail: 'No PDF uploaded for this floor' } })
                    return
                }
                await route.fulfill({ json: { url: `https://pdf.test/${floorId}` } })
                return
            }
            if (method === 'GET' && !parts[4]) {
                if (!floor) {
                    await route.fulfill({ status: 404, json: { detail: 'Floor not found' } })
                    return
                }
                await route.fulfill({ json: floor })
                return
            }
        }

        await route.fulfill({ json: method === 'GET' && parts.length === 1 ? [] : {} })
    })

    return { project, pdfUploads, pdfByFloorId }
}

test('Level 1 plan survives save (new floor ids) + switch + reload', async ({ page }) => {
    mkdirSync(SHOT_DIR, { recursive: true })
    await page.addInitScript(() => localStorage.setItem('upload-canvas-username', 'Canvas test'))
    const backend = await installRecreatingSaveBackend(page)

    await page.goto('/')
    await expect(page.getByText('Signing in with Microsoft')).toHaveCount(0)

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Level 1 PDF persist')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)
    await expect(page.getByRole('button', { name: 'All Projects' })).toBeVisible({ timeout: 30000 })

    await page.getByTestId('add-floor-cluster-button').click()
    await expect(page.getByTestId('floor-tab-1')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('drafting-sheet-banner')).toBeVisible()
    await page.getByTestId('banner-reuse-ground-pdf-button').click()
    await expect(page.getByTestId('drafting-sheet-banner')).toHaveCount(0)

    await expect.poll(async () => page.evaluate(() => {
        const s = (window as unknown as { __useStore: { getState: () => {
            floors: Array<{ floor_number: number, pdf_s3_key: string | null, hasCustomPdf?: boolean, pdfSource?: string, id?: string }>
        } } }).__useStore.getState()
        const level1 = s.floors.find((f) => f.floor_number === 1) || s.floors[1]
        return {
            hasCustomPdf: Boolean(level1?.hasCustomPdf),
            pdfSource: level1?.pdfSource || null,
            key: level1?.pdf_s3_key || null,
            placeholder: typeof level1?.pdf_s3_key === 'string' && /^uploaded_\d+$/.test(level1.pdf_s3_key),
        }
    }), { timeout: 20000 }).toEqual(expect.objectContaining({
        hasCustomPdf: true,
        pdfSource: 'ground',
        placeholder: false,
    }))

    await page.screenshot({ path: `${SHOT_DIR}/01-level-1-reused-ground.png`, fullPage: false })

    await page.getByTestId('floor-tab-0').click()
    await page.getByTestId('floor-tab-1').click()
    await expect(page.getByTestId('drafting-sheet-banner')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => {
        const pdf = (window as unknown as { __useStore: { getState: () => { pdfData?: { isBlank?: boolean } } } }).__useStore.getState().pdfData
        return Boolean(pdf) && !pdf?.isBlank
    })).toBe(true)

    await page.screenshot({ path: `${SHOT_DIR}/02-level-1-after-switch.png`, fullPage: false })

    // Simulate a hard reload: drop memory + IndexedDB so restore must use S3
    // on the post-save floor id (the rebind path).
    await page.evaluate(async () => {
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase('keyval-store')
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
            req.onblocked = () => resolve()
        })
    })
    await page.getByRole('button', { name: 'All Projects' }).click()
    await expect(page.getByText('Level 1 PDF persist')).toBeVisible({ timeout: 15000 })
    await page.getByText('Level 1 PDF persist').click()
    await expect(page.getByTestId('add-floor-cluster-button').or(page.getByTestId('floor-bar'))).toBeVisible({ timeout: 30000 })

    await page.getByTestId('floor-tab-1').click()
    await expect(page.getByTestId('floor-tab-1')).toBeVisible()
    await expect(page.getByTestId('drafting-sheet-banner')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => {
        const s = (window as unknown as { __useStore: { getState: () => {
            pdfData?: { isBlank?: boolean }
            floors: Array<{ floor_number: number, pdf_s3_key: string | null, hasCustomPdf?: boolean }>
            activeFloorIndex: number
        } } }).__useStore.getState()
        const level1 = s.floors.find((f) => f.floor_number === 1)
        return {
            active: s.activeFloorIndex,
            blank: Boolean(s.pdfData?.isBlank),
            hasCustomPdf: Boolean(level1?.hasCustomPdf),
            hasKey: Boolean(level1?.pdf_s3_key && !/^uploaded_\d+$/.test(level1.pdf_s3_key)),
        }
    })).toEqual({ active: 1, blank: false, hasCustomPdf: true, hasKey: true })

    await page.screenshot({ path: `${SHOT_DIR}/03-level-1-after-reload.png`, fullPage: false })

    const level1Uploads = backend.pdfUploads.filter((id) => {
        const floor = backend.project.floors.find((f) => f.id === id)
        return floor?.floor_number === 1
    })
    expect(level1Uploads.length).toBeGreaterThan(0)
    expect(backend.project.floors[1]?.pdf_s3_key).toMatch(/\/floors\/floor-\d+\/plan\.pdf$/)
})
