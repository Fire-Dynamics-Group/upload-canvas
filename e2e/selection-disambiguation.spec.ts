import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

/**
 * Bootstrap: load the sample project, clear elements, seed a wall + door
 * sharing a vertex so all four scenarios can start from a known state.
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

    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    await page.waitForFunction(() => (window as any).__store !== undefined, { timeout: 10000 })

    // Clear and switch to selection tool
    await page.evaluate(() => {
        const store = (window as any).__store
        store.setState({ elements: [], selectedElement: null })
        store.getState().setTool('selection')
    })
}

function getCanvasBox(page: import('@playwright/test').Page) {
    return page.locator('canvas').last().boundingBox()
}

async function seedWallAndDoorSharingVertex(page: import('@playwright/test').Page) {
    // Place a wall at canvas coords (400, 200) -> (400, 500) and a door whose
    // first point is the shared vertex at (400, 500) extending to (420, 500).
    // These are page-local canvas coordinates (pageX/pageY the click handler uses).
    const box = await getCanvasBox(page)
    if (!box) throw new Error('Canvas not found')
    const originX = box.x
    const originY = box.y
    const shared = { x: originX + 400, y: originY + 500 }

    await page.evaluate(({ shared }) => {
        const store = (window as any).__store
        // Wall (polyline, obstruction) – drawn first, higher insertion order
        store.getState().addElement({
            type: 'polyline',
            points: [
                { x: shared.x - 200, y: shared.y - 300 },
                { x: shared.x, y: shared.y },
            ],
            comments: 'obstruction',
            id: 7001,
        })
        // Door (polyline, 2 points) – second so legacy first-iterated-wins
        // would have picked the wall; the new logic should pick the door.
        store.getState().addElement({
            type: 'polyline',
            points: [
                { x: shared.x, y: shared.y },
                { x: shared.x + 20, y: shared.y },
            ],
            comments: 'door',
            id: 7002,
        })
    }, { shared })

    return { originX, originY, shared }
}

async function readSelectedElement(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const sel = (window as any).__store.getState().selectedElement
        if (!sel) return null
        return { id: sel.element.id, comments: sel.element.comments }
    })
}

async function readElementIds(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
        (window as any).__store.getState().elements.map((e: any) => e.id)
    )
}

test.describe('Selection disambiguation', () => {
    test('default pick is the smallest-bbox element (door wins over wall)', async ({ page }) => {
        await bootstrap(page)
        const { shared } = await seedWallAndDoorSharingVertex(page)

        await page.mouse.click(shared.x, shared.y)
        await page.waitForTimeout(150)

        const selected = await readSelectedElement(page)
        expect(selected).not.toBeNull()
        expect(selected!.comments).toBe('door')
        expect(selected!.id).toBe(7002)

        // Escape deletes the door, wall remains
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        const ids = await readElementIds(page)
        expect(ids).toContain(7001) // wall
        expect(ids).not.toContain(7002) // door gone
    })

    test('Alt+click cycles through stacked candidates', async ({ page }) => {
        await bootstrap(page)
        const { shared } = await seedWallAndDoorSharingVertex(page)

        // First click: door is selected (smallest bbox)
        await page.mouse.click(shared.x, shared.y)
        await page.waitForTimeout(150)
        let selected = await readSelectedElement(page)
        expect(selected!.comments).toBe('door')

        // Alt+click same spot: cycles to wall
        await page.keyboard.down('Alt')
        await page.mouse.click(shared.x, shared.y)
        await page.keyboard.up('Alt')
        await page.waitForTimeout(150)
        selected = await readSelectedElement(page)
        expect(selected!.comments).toBe('obstruction')

        // Escape deletes the wall now, door should remain
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        const ids = await readElementIds(page)
        expect(ids).toContain(7002) // door
        expect(ids).not.toContain(7001) // wall gone
    })

    test('chip list is rendered with candidates and can switch selection', async ({ page }) => {
        await bootstrap(page)
        const { shared } = await seedWallAndDoorSharingVertex(page)

        await page.mouse.click(shared.x, shared.y)
        await page.waitForTimeout(150)

        const chipList = page.locator('[data-testid="selection-chip-list"]')
        await expect(chipList).toBeVisible()

        // Two chips: door (index 0) and wall (index 1)
        const chip0 = page.locator('[data-testid="selection-chip-0"]')
        const chip1 = page.locator('[data-testid="selection-chip-1"]')
        await expect(chip0).toBeVisible()
        await expect(chip1).toBeVisible()
        await expect(chip0).toHaveText(/door/i)
        await expect(chip1).toHaveText(/obstruction/i)

        // Click the wall chip – selection should flip
        await chip1.click()
        await page.waitForTimeout(150)
        const selected = await readSelectedElement(page)
        expect(selected!.comments).toBe('obstruction')
    })

    test('chip list disappears when selection is cleared by clicking empty space', async ({ page }) => {
        await bootstrap(page)
        const { originX, originY, shared } = await seedWallAndDoorSharingVertex(page)

        await page.mouse.click(shared.x, shared.y)
        await page.waitForTimeout(150)
        await expect(page.locator('[data-testid="selection-chip-list"]')).toBeVisible()

        // Click far away from any element
        await page.mouse.click(originX + 900, originY + 100)
        await page.waitForTimeout(150)
        await expect(page.locator('[data-testid="selection-chip-list"]')).toHaveCount(0)
    })
})
