import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const SHOT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/grid-not-showing'

test.use({ viewport: { width: 1440, height: 900 } })

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
                    id: 'proj-grid',
                    name: 'Grid',
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
    await page.getByPlaceholder('Project name').fill('Grid')
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

test('drawing/snap grid sits above the PDF after scale is set', async ({ page }, testInfo) => {
    await bootstrapSitePlan(page)

    await page.evaluate(() => {
        const s = (window as any).__useStore || (window as any).__store
        s.setState({ pixelsPerMesh: 33.6, tool: 'polyline', comment: 'obstruction' })
        s.getState().setTool('polyline')
        s.getState().setComment('obstruction')
    })

    await page.evaluate(() => window.scrollTo(0, 0))
    const stage = page.locator('canvas.z-10')
    await expect(stage).toBeVisible()
    const shotName = process.env.GRID_SHOT === 'before'
        ? '01-before-grid-missing.png'
        : '02-after-grid-visible.png'
    await stage.screenshot({ path: `${SHOT_DIR}/${shotName}` })

    const stack = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'))
        return canvases.map((el) => {
            const style = getComputedStyle(el)
            return {
                className: el.className,
                zIndex: style.zIndex,
                pointerEvents: style.pointerEvents,
                width: el.getBoundingClientRect().width,
            }
        })
    })

    const grid = stack.find((c) => c.className.includes('z-[5]') || /\bz-5\b/.test(c.className))
    const pdf = stack.find((c) => c.className.includes('pointer-events-none') && !c.className.includes('z-10') && !/\bz-5\b/.test(c.className) && !c.className.includes('z-[5]'))
    expect(grid, `grid canvas missing; canvases=${JSON.stringify(stack)}`).toBeTruthy()
    expect(pdf, `pdf canvas missing; canvases=${JSON.stringify(stack)}`).toBeTruthy()
    expect(Number(grid!.zIndex)).toBeGreaterThan(Number(pdf!.zIndex === 'auto' ? '0' : pdf!.zIndex))
    expect(grid!.pointerEvents).toBe('none')
})
