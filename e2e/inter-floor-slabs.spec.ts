import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const RAILWAY_DEV = 'https://backendfornextapp-dev.up.railway.app'
const OUT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/inter-floor-slabs'

test.use({ viewport: { width: 1440, height: 900 } })

test('inter-floor 0.2 m concrete slab with stair void', async ({ page }) => {
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
                    id: 'proj-inter-floor-slabs',
                    name: 'Inter-floor slabs',
                    floors: [{ id: 'floor-0', floor_number: 0, name: 'Fire Floor' }],
                },
            })
            return
        }
        await route.fulfill({ json: {} })
    })

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
        const resp = await fetch(`${RAILWAY_DEV}/fds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: route.request().postData() || '{}',
        })
        const body = await resp.text()
        await route.fulfill({
            status: resp.status,
            headers: { ...cors, 'content-type': resp.headers.get('content-type') || 'application/json' },
            body,
        })
    })

    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}))
    await page.goto('/')
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important;}' }).catch(() => {})

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Inter-floor slabs')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)
    await expect(page.getByTestId('add-floor-cluster-button')).toBeVisible({ timeout: 30000 })

    const enterBtn = page.getByRole('button', { name: 'Enter', exact: true })
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
    }

    await page.getByTestId('add-floor-cluster-button').click()
    await expect(page.getByTestId('floor-bar')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('banner-reuse-ground-pdf-button').click()

    await page.waitForFunction(() => Boolean((window as any).__useStore), null, { timeout: 30000 })
    await page.evaluate(() => {
        ;(window as any).__useStore.setState({ fdsCode: '', fdsGenSig: null })
    })

    await page.evaluate(() => {
        const store = (window as any).__useStore
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
        store.getState().addElement({
            id: 1,
            type: 'rect',
            comments: 'mesh',
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
            ],
        })
        store.getState().addElement({
            id: 2,
            type: 'polyline',
            comments: 'obstruction',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        })
        store.getState().setActiveFloor(1)
        store.setState({ ...shared, fireFloorZ: 3 })
        store.getState().addElement({
            id: 1,
            type: 'rect',
            comments: 'mesh',
            points: [
                { x: 20, y: 20 },
                { x: 80, y: 20 },
                { x: 80, y: 80 },
                { x: 20, y: 80 },
            ],
        })
        store.getState().addElement({
            id: 2,
            type: 'polyline',
            comments: 'obstruction',
            points: [{ x: 20, y: 20 }, { x: 80, y: 20 }],
        })
        store.getState().addElement({
            id: 3,
            type: 'rect',
            comments: 'stairMesh',
            points: [
                { x: 40, y: 40 },
                { x: 55, y: 40 },
                { x: 55, y: 70 },
                { x: 40, y: 70 },
            ],
        })
    })

    await page.getByRole('button', { name: 'Generate FDS code' }).click()
    await expect.poll(async () => {
        return page.evaluate(() => ((window as any).__useStore.getState().fdsCode || '').length)
    }, { timeout: 60000 }).toBeGreaterThan(1000)

    const live = await page.evaluate(() => (window as any).__useStore.getState().fdsCode as string)
    writeFileSync(path.join(OUT_DIR, 'slab-live.fds'), live)
    const slab = live.split(/\r?\n/).find((l) => /Slab/i.test(l) && /^\s*&OBST\b/i.test(l)) || ''
    const hole = live.split(/\r?\n/).find((l) => /^\s*&HOLE\b/i.test(l)) || ''
    expect(slab).toMatch(/SURF_ID='Concrete'/i)
    expect(slab).not.toMatch(/Plasterboard/i)
    const xb = slab.match(/XB=\s*([^/]+)/i)?.[1].split(',').map(Number) || []
    expect(xb[5] - xb[4]).toBeCloseTo(0.2, 5)
    expect(hole).toMatch(/&HOLE /)
    writeFileSync(path.join(OUT_DIR, 'slab-obst-hole.txt'), `${slab}\n${hole}\n`)

    await page.getByRole('button', { name: 'FDS Code', exact: true }).click()
    await expect(page.getByText("SURF_ID='Concrete'", { exact: false })).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: path.join(OUT_DIR, '01-fds-code.png'), fullPage: false })

    await page.getByRole('button', { name: '3D View', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Frame', exact: true })).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Frame', exact: true }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(OUT_DIR, '02-3d-slab.png'), fullPage: false })
})
