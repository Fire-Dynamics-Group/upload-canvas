import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const SHOT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/escape-delete-obstruction'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)

test.use({ viewport: { width: 1440, height: 900 } })

/**
 * Highlighted obstruction + Escape: click (down AND up) then Escape must
 * remove the wall. handlePointerUp used to clear selection on every click,
 * so Escape after highlighting did nothing.
 */
async function bootstrapSitePlan(page: import('@playwright/test').Page) {
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
                    id: 'proj-escape-delete',
                    name: 'Escape delete',
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
    await page.getByPlaceholder('Project name').fill('Escape delete')
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

function canvasClick(
    box: { x: number; y: number },
    zoom: number,
    canvasX: number,
    canvasY: number,
) {
    return { x: box.x + canvasX * zoom, y: box.y + canvasY * zoom }
}

test('Escape deletes a highlighted obstruction after mouse-up', async ({ page }) => {
    const drawing = await bootstrapSitePlan(page)

    await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        s.setState({
            pixelsPerMesh: 33.6,
            currentMode: 'fdsGen',
            elements: [{
                id: 9001,
                type: 'polyline',
                comments: 'obstruction',
                points: [{ x: 400, y: 200 }, { x: 400, y: 400 }],
            }],
            selectedElement: null,
        })
        s.getState().setTool('selection')
    })

    const zoom = await drawing.evaluate((el: HTMLCanvasElement) => el.getBoundingClientRect().width / el.width)
    const box = await drawing.boundingBox()
    if (!box) throw new Error('drawing canvas has no box')

    // Click the wall body (not a vertex) — the highlight path people actually use.
    mkdirSync(SHOT_DIR, { recursive: true })
    const mid = canvasClick(box, zoom, 400, 300)
    await page.mouse.click(mid.x, mid.y)

    await expect.poll(async () => {
        return page.evaluate(() => {
            const s = (window as any).__useStore || (window as any).__store
            return s.getState().selectedElement?.element?.id ?? null
        })
    }).toBe(9001)
    await page.screenshot({ path: `${SHOT_DIR}/01-obstruction-highlighted.png` })

    await page.keyboard.press('Escape')

    await expect.poll(async () => {
        return page.evaluate(() => {
            const s = (window as any).__useStore || (window as any).__store
            return s.getState().elements.map((e: { id: number }) => e.id)
        })
    }).toEqual([])
    await page.screenshot({ path: `${SHOT_DIR}/02-obstruction-gone-after-escape.png` })

    const selected = await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        return s.getState().selectedElement
    })
    expect(selected).toBeNull()
})
