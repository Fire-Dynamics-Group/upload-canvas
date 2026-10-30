import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const RAILWAY_DEV = 'https://backendfornextapp-dev.up.railway.app'
const OUT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/multi-floor-fds-output'

test.use({ viewport: { width: 1440, height: 900 } })

test('two floors: live POST /fds combines stacked meshes into one file', async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true })

    await page.route('**/projects**', async (route) => {
        const method = route.request().method()
        if (method === 'GET') {
            await route.fulfill({ json: [] })
            return
        }
        if (method === 'POST') {
            await route.fulfill({
                json: {
                    id: 'proj-multi-floor-generate',
                    name: 'Multi-floor FDS generate',
                    floors: [{ id: 'floor-0', floor_number: 0, name: 'Fire Floor' }],
                },
            })
            return
        }
        await route.fulfill({ json: {} })
    })

    let fdsPosts = 0
    await page.route('**/fds', async (route) => {
        const cors = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization',
        }
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: cors })
            return
        }
        fdsPosts += 1
        const resp = await fetch(`${RAILWAY_DEV}/fds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: route.request().postData() || '{}',
        })
        const body = await resp.text()
        await route.fulfill({
            status: resp.status,
            headers: {
                ...cors,
                'content-type': resp.headers.get('content-type') || 'application/json',
            },
            body,
        })
    })

    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}))

    await page.goto('/')
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important;}' }).catch(() => {})
    await expect(page.getByText('Signing in with Microsoft')).toHaveCount(0)

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Multi-floor FDS generate')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)

    const clusterAdd = page.getByTestId('add-floor-cluster-button')
    await expect(clusterAdd).toBeVisible({ timeout: 30000 })
    await clusterAdd.click()
    await expect(page.getByTestId('floor-bar')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('banner-reuse-ground-pdf-button').click()
    await expect(page.getByTestId('drafting-sheet-banner')).toHaveCount(0)

    const enterBtn = page.getByRole('button', { name: 'Enter', exact: true })
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
    }

    await page.waitForFunction(() => Boolean((window as any).__useStore), null, { timeout: 30000 })
    await page.evaluate(() => {
        const store = (window as any).__useStore
        const mesh = {
            id: 1,
            type: 'rect',
            comments: 'mesh',
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
            ],
        }
        const wall = {
            id: 2,
            type: 'polyline',
            comments: 'obstruction',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        }
        const opening = {
            id: 3,
            type: 'rect',
            comments: 'floorOpening',
            points: [
                { x: 30, y: 30 },
                { x: 50, y: 30 },
                { x: 50, y: 50 },
                { x: 30, y: 50 },
            ],
        }
        const shared = {
            tool: 'selection',
            pixelsPerMesh: 1,
            originPixels: { x: 0, y: 0 },
            isSprinklered: false,
            includeSensors: false,
            simEndTime: 30,
            doorLeakagesEnabled: false,
            wallHeight: 3,
            totalFloors: 2,
        }
        store.getState().setActiveFloor(0)
        store.setState({ ...shared, fireFloorZ: 0 })
        store.getState().addElement(mesh)
        store.getState().addElement(wall)
        store.getState().setActiveFloor(1)
        // Keep the stacked z_level addFloor already assigned (do not reset fireFloorZ).
        store.setState({ ...shared, fireFloorZ: 3 })
        store.getState().addElement({ ...mesh })
        store.getState().addElement({ ...wall })
        store.getState().addElement(opening)
    })

    await expect(page.getByRole('button', { name: 'Generate FDS code' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Generate FDS code' }).click()

    await expect.poll(async () => {
        return page.evaluate(() => ((window as any).__useStore.getState().fdsCode || '').length)
    }, { timeout: 60000 }).toBeGreaterThan(200)

    expect(fdsPosts).toBeGreaterThanOrEqual(2)

    const combined = await page.evaluate(() => (window as any).__useStore.getState().fdsCode as string)
    writeFileSync(path.join(OUT_DIR, 'two-floor-ui.fds'), combined)

    expect(combined.match(/&HEAD\b/g)).toHaveLength(1)
    expect(combined.match(/&TAIL\b/g)).toHaveLength(1)
    expect(combined).toMatch(/&MESH ID='F0_/)
    expect(combined).toMatch(/&MESH ID='F1_/)
    expect(combined).toMatch(/Slab/)
    expect(combined).toMatch(/&HOLE /)
    const meshLines = combined.split(/\r?\n/).filter((l) => l.trim().toUpperCase().startsWith('&MESH'))
    const zMins = meshLines.map((line) => {
        const xb = line.match(/XB=([^/]+)/i)?.[1].split(',').map(Number)
        return xb ? xb[4] : NaN
    })
    expect(Math.min(...zMins)).toBeCloseTo(0, 1)
    expect(Math.max(...zMins)).toBeGreaterThan(2)

    await page.getByRole('button', { name: 'FDS Code', exact: true }).click()
    await expect(page.getByText("&MESH ID='F0_", { exact: false })).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: path.join(OUT_DIR, '01-fds-code-view.png'), fullPage: false })

    await page.getByRole('button', { name: '3D View', exact: true }).click()
    const frameBtn = page.getByRole('button', { name: 'Frame', exact: true })
    await expect(frameBtn).toBeVisible({ timeout: 30000 })
    await frameBtn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(OUT_DIR, '02-3d-view.png'), fullPage: false })
})
