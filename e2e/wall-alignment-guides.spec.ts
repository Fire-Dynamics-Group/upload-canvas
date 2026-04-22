import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

/**
 * Bootstrap: load the sample project so we have a canvas with scale set.
 * Then clear the store's element list so we have a clean drawing surface.
 */
async function bootstrap(page: import('@playwright/test').Page) {
    await page.goto('/')

    const nameInput = page.locator('input[placeholder="Your name"]')
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('TestUser')
        await page.click('text=Continue')
        await page.waitForTimeout(1000)
    }

    const projectCard = page.getByRole('heading', { name: PROJECT_NAME, exact: true })
    await projectCard.waitFor({ state: 'attached', timeout: 60000 })
    await projectCard.scrollIntoViewIfNeeded()
    await projectCard.click()

    // Wait for canvas to be ready
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // Close any open popup (e.g. FDS Inputs)
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // Ensure the debug store hook is available
    await page.waitForFunction(() => (window as any).__store !== undefined, { timeout: 10000 })

    // Clear committed elements for a clean drawing slate
    await page.evaluate(() => {
        const store = (window as any).__store
        const state = store.getState()
        // Overwrite elements directly via setState (zustand)
        store.setState({ elements: [], selectedElement: null })
    })
}

function getCanvasBox(page: import('@playwright/test').Page) {
    return page.locator('canvas').last().boundingBox()
}

async function setTool(page: import('@playwright/test').Page, tool: string, comment: string) {
    await page.evaluate(({ tool, comment }) => {
        const store = (window as any).__store
        store.getState().setTool(tool)
        store.getState().setComment(comment)
    }, { tool, comment })
}

async function readElements(page: import('@playwright/test').Page) {
    return page.evaluate(() => (window as any).__store.getState().elements)
}

async function readSnapGuides(page: import('@playwright/test').Page) {
    // snapGuides is Canvas component state, not store state. We can't read it
    // directly, so we infer by committed coordinate alignment.
    return null
}

test.describe('Alignment guides for polyline/point tools', () => {
    test('wall-to-wall alignment: 2nd wall snaps to 1st wall vertex X', async ({ page }) => {
        await bootstrap(page)
        await setTool(page, 'polyline', 'obstruction')

        // Seed a committed wall at canvas coordinates (400, 200) -> (400, 400).
        // Using the store directly to avoid depending on click timing for the setup.
        await page.evaluate(() => {
            const store = (window as any).__store
            store.getState().addElement({
                type: 'polyline',
                points: [{ x: 400, y: 200 }, { x: 400, y: 400 }],
                comments: 'obstruction',
                id: 9001,
            })
        })

        // Draw a second wall: click near x=403 (3px off 400), then at x=500, then Enter.
        const box = await getCanvasBox(page)
        if (!box) throw new Error('Canvas not found')
        const originX = box.x
        const originY = box.y

        // Hover near 403 to warm up the guide, then click
        await page.mouse.move(originX + 403, originY + 550)
        await page.mouse.click(originX + 403, originY + 550)
        await page.waitForTimeout(100)
        await page.mouse.click(originX + 600, originY + 550)
        await page.waitForTimeout(100)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(200)

        const elements = await readElements(page)
        const newWalls = elements.filter((e: any) => e.id !== 9001 && e.type === 'polyline' && e.comments === 'obstruction')
        expect(newWalls.length).toBeGreaterThanOrEqual(1)
        const newWall = newWalls[newWalls.length - 1]
        // First vertex's X should have snapped to 400
        expect(newWall.points[0].x).toBe(400)
    })

    test('door 2-click alignment: 2nd click snaps to 1st click X via in-progress', async ({ page }) => {
        await bootstrap(page)
        await setTool(page, 'polyline', 'door')

        const box = await getCanvasBox(page)
        if (!box) throw new Error('Canvas not found')
        const originX = box.x
        const originY = box.y

        // First click at (350, 300)
        await page.mouse.click(originX + 350, originY + 300)
        await page.waitForTimeout(100)
        // Second click at x=353 (3px off the first — within threshold)
        await page.mouse.move(originX + 353, originY + 500)
        await page.mouse.click(originX + 353, originY + 500)
        await page.waitForTimeout(200)

        const elements = await readElements(page)
        const doors = elements.filter((e: any) => e.comments === 'door')
        expect(doors.length).toBeGreaterThanOrEqual(1)
        const door = doors[doors.length - 1]
        expect(door.points.length).toBe(2)
        // Both points should have the same X because point 2 snapped to point 1
        expect(door.points[1].x).toBe(door.points[0].x)
    })

    test('polyline vertex 3 aligns to vertex 1 Y', async ({ page }) => {
        await bootstrap(page)
        await setTool(page, 'polyline', 'obstruction')

        const box = await getCanvasBox(page)
        if (!box) throw new Error('Canvas not found')
        const originX = box.x
        const originY = box.y

        // Click 3 vertices. Vertex 1 Y=250, vertex 2 arbitrary, vertex 3 near Y=252 (2px off vertex 1)
        await page.mouse.click(originX + 300, originY + 250)
        await page.waitForTimeout(80)
        await page.mouse.click(originX + 500, originY + 400)
        await page.waitForTimeout(80)
        await page.mouse.move(originX + 700, originY + 252)
        await page.mouse.click(originX + 700, originY + 252)
        await page.waitForTimeout(80)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(200)

        const elements = await readElements(page)
        const walls = elements.filter((e: any) => e.type === 'polyline' && e.comments === 'obstruction')
        expect(walls.length).toBeGreaterThanOrEqual(1)
        const wall = walls[walls.length - 1]
        // Vertex 1 and vertex 3 should share Y
        expect(wall.points[0].y).toBe(wall.points[2].y)
    })
})
