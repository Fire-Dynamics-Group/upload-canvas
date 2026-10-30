import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const SHOT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/kevin-snap-pr'

test.use({ viewport: { width: 1440, height: 900 } })

/**
 * KK CSS-zoom regression: 15 canvas-px magnet collapses on zoom-out.
 * At zoom 0.25, 30 canvas px is only 7.5 screen px — inside a 15 screen-px
 * magnet, outside the old 15 canvas-px magnet. FDS obstruction walls were
 * also skipped entirely by the EFS freehand path.
 */
async function bootstrapSitePlan(page: import('@playwright/test').Page) {
    mkdirSync(SHOT_DIR, { recursive: true })
    await page.addInitScript(() => localStorage.setItem('upload-canvas-username', 'Canvas test'))
    await page.route('**/projects**', async (route) => {
        const method = route.request().method()
        if (method === 'GET') {
            await route.fulfill({ json: [] })
            return
        }
        if (method === 'POST') {
            await route.fulfill({
                json: {
                    id: 'proj-zoom-snap',
                    name: 'Zoom snap',
                    floors: [{ id: 'floor-0', floor_number: 0, name: 'Fire Floor' }],
                },
            })
            return
        }
        await route.fulfill({ json: {} })
    })

    await page.goto('/')
    await expect(page.getByText('Signing in with Microsoft')).toHaveCount(0)

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Zoom snap')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)

    const enterBtn = page.getByRole('button', { name: 'Enter', exact: true })
    if (await enterBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await enterBtn.click()
    }

    await page.waitForFunction(() => Boolean((window as any).__useStore || (window as any).__store), null, { timeout: 30000 })
    await page.keyboard.press('Escape')

    const drawing = page.locator('canvas.z-10')
    await expect(drawing).toBeVisible({ timeout: 30000 })
    return drawing
}

async function zoomOutToMin(page: import('@playwright/test').Page, drawing: import('@playwright/test').Locator) {
    const box = await drawing.boundingBox()
    if (!box) throw new Error('drawing canvas has no box')
    await page.mouse.move(box.x + Math.min(80, box.width / 2), box.y + Math.min(80, box.height / 2))
    await page.keyboard.down('Control')
    for (let i = 0; i < 8; i += 1) {
        await page.mouse.wheel(0, 400)
    }
    await page.keyboard.up('Control')
    await expect.poll(async () => {
        return drawing.evaluate((el: HTMLCanvasElement) => el.getBoundingClientRect().width / el.width)
    }).toBeLessThan(0.4)
}

function canvasClick(
    box: { x: number; y: number },
    zoom: number,
    canvasX: number,
    canvasY: number,
) {
    return { x: box.x + canvasX * zoom, y: box.y + canvasY * zoom }
}

test('FDS wall snaps at zoom-out 30 canvas px off a vertex (15 screen-px magnet)', async ({ page }) => {
    const drawing = await bootstrapSitePlan(page)

    await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        s.setState({
            tool: 'polyline',
            comment: 'obstruction',
            pixelsPerMesh: 33.6,
            currentMode: 'fdsGen',
            elements: [{
                id: 9001,
                type: 'polyline',
                comments: 'obstruction',
                points: [{ x: 400, y: 200 }, { x: 400, y: 400 }],
            }],
        })
        s.getState().setTool('polyline')
        s.getState().setComment('obstruction')
    })

    await zoomOutToMin(page, drawing)
    const zoom = await drawing.evaluate((el: HTMLCanvasElement) => el.getBoundingClientRect().width / el.width)
    const box = await drawing.boundingBox()
    if (!box) throw new Error('drawing canvas has no box')

    // 30 canvas px off the wall X=400. At zoom 0.25 that is 7.5 screen px.
    const first = canvasClick(box, zoom, 430, 550)
    const second = canvasClick(box, zoom, 620, 550)
    await page.mouse.move(first.x, first.y)
    await page.screenshot({ path: `${SHOT_DIR}/01-wall-hover-zoomed-out.png` })
    await page.mouse.click(first.x, first.y)
    await page.mouse.click(second.x, second.y)
    await page.keyboard.press('Enter')

    const newWall = await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        return s.getState().elements.filter((e: { id: number }) => e.id !== 9001).at(-1)
    })
    expect(newWall?.comments).toBe('obstruction')
    expect(newWall?.points?.[0]?.x).toBe(400)
    await page.screenshot({ path: `${SHOT_DIR}/02-wall-snapped-after-click.png` })
})

test('mesh edge snaps at zoom-out 30 canvas px off an existing mesh', async ({ page }) => {
    const drawing = await bootstrapSitePlan(page)

    await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        s.setState({
            tool: 'rect',
            comment: 'mesh',
            pixelsPerMesh: 33.6,
            currentMode: 'fdsGen',
            elements: [{
                id: 9002,
                type: 'rect',
                comments: 'mesh',
                points: [{ x: 100, y: 100 }, { x: 300, y: 200 }],
            }],
        })
        s.getState().setTool('rect')
        s.getState().setComment('mesh')
    })

    await zoomOutToMin(page, drawing)
    const zoom = await drawing.evaluate((el: HTMLCanvasElement) => el.getBoundingClientRect().width / el.width)
    const box = await drawing.boundingBox()
    if (!box) throw new Error('drawing canvas has no box')

    const first = canvasClick(box, zoom, 330, 80)
    const second = canvasClick(box, zoom, 500, 260)
    await page.mouse.click(first.x, first.y)
    await page.mouse.click(second.x, second.y)

    const newMesh = await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        return s.getState().elements.filter((e: { id: number }) => e.id !== 9002).at(-1)
    })
    expect(newMesh?.comments).toBe('mesh')
    expect(newMesh?.points?.[0]?.x).toBe(300)
    await page.screenshot({ path: `${SHOT_DIR}/03-mesh-snapped-zoomed-out.png` })
})

test('EFS wall stays freehand at zoom-out 30 canvas px off an existing wall', async ({ page }) => {
    const drawing = await bootstrapSitePlan(page)

    await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        s.setState({
            tool: 'polyline',
            comment: 'efsWall',
            pixelsPerMesh: 33.6,
            currentMode: 'efs',
            elements: [{
                id: 9003,
                type: 'polyline',
                comments: 'efsWall',
                points: [{ x: 400, y: 200 }, { x: 400, y: 400 }],
            }],
        })
        s.getState().setTool('polyline')
        s.getState().setComment('efsWall')
    })

    await zoomOutToMin(page, drawing)
    const zoom = await drawing.evaluate((el: HTMLCanvasElement) => el.getBoundingClientRect().width / el.width)
    const box = await drawing.boundingBox()
    if (!box) throw new Error('drawing canvas has no box')

    const first = canvasClick(box, zoom, 430, 550)
    const second = canvasClick(box, zoom, 620, 550)
    await page.mouse.move(first.x, first.y)
    await page.screenshot({ path: `${SHOT_DIR}/04-efs-wall-hover-freehand.png` })
    await page.mouse.click(first.x, first.y)
    await page.mouse.click(second.x, second.y)
    await page.keyboard.press('Enter')

    const newWall = await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        return s.getState().elements.filter((e: { id: number }) => e.id !== 9003).at(-1)
    })
    expect(newWall?.comments).toBe('efsWall')
    // Freehand: 30 canvas px off X=400 must NOT magnetise to 400.
    expect(newWall?.points?.[0]?.x).not.toBe(400)
    expect(newWall?.points?.[0]?.x).toBeCloseTo(430, 0)
    await page.screenshot({ path: `${SHOT_DIR}/05-efs-wall-stays-freehand.png` })
})
