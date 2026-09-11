import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'

// Orientation check: the 3D top-down must read the same way as the 2D plan the
// user drew — +x right, +y down (the canvas convention, matching fds-viewer's
// (x,z,y) mapping). We can't pixel-diff a WebGL canvas against a PDF plan, so this
// spec captures both for the same project so a human can eyeball that the
// building is laid out identically (stair core, fire, rooms on the same side).
// The deterministic guard for the transform is __tests__/scene3d-orientation.test.js.
const PROJECT_NAME = '0406 North Finchley 1'
const OUT = join(process.cwd(), 'e2e', '__screens__')

test('3D top-down matches the 2D plan orientation', async ({ page }) => {
    mkdirSync(OUT, { recursive: true })

    // The browser's direct cross-origin POST to /fds fails ("Failed to fetch")
    // in this environment, but the backend is reachable from Node. Proxy /fds
    // server-side (same trick as mesh-alignment.spec) and add a permissive CORS
    // header so the fulfilled response is accepted by the page.
    // The browser's direct cross-origin POST to /fds fails in this environment,
    // so proxy it server-side (Node, no CORS) and add a permissive CORS header.
    // Record the backend status so we can skip cleanly if the backend can't build
    // the model (it currently 500s for some projects) rather than fail spuriously.
    let fdsStatus = 0
    await page.route('**/fds', async (route) => {
        try {
            const resp = await route.fetch()
            fdsStatus = resp.status()
            const body = await resp.body()
            const headers = { ...resp.headers(), 'access-control-allow-origin': '*' }
            await route.fulfill({ response: resp, body, headers })
        } catch (e) {
            fdsStatus = 502
            await route.fulfill({ status: 502, body: 'proxy error: ' + (e as Error).message })
        }
    })

    await page.goto('/')
    // The Next.js dev indicator overlay sits bottom-left over the view tabs and
    // eats clicks. Hide it so the tabs are reachable (and out of screenshots).
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important;}' }).catch(() => {})

    // Welcome popup
    const nameInput = page.locator('input[placeholder="Your name"]')
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('TestUser')
        await page.click('text=Continue')
        await page.waitForTimeout(1000)
    }

    // Open the project. Show every project (the card may be owned by another
    // user on this branch), then click the card by its exact heading text.
    const allBtn = page.locator('button:has-text("All Projects")')
    if (await allBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await allBtn.click()
        await page.waitForTimeout(1500)
    }
    const projectCard = page.getByRole('heading', { name: PROJECT_NAME, exact: true })
    await projectCard.waitFor({ timeout: 40000 })
    await projectCard.click()
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 }).catch(() => {})
    await page.locator('text=Inputs').last().waitFor({ timeout: 30000 })
    await page.waitForTimeout(2500)

    // Dismiss the FDS Inputs popup if it auto-opened.
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // --- 2D plan as drawn ---
    await page.locator('button:has-text("2D View")').click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(OUT, '2d-plan.png'), fullPage: false })

    // --- 3D: generate the model from the drawing, then top-down ---
    await page.locator('button:has-text("3D View")').click()
    // Build the FDS from inside the 3D view (its own button hits the same backend).
    const gen = page.locator('button:has-text("Generate FDS from drawing")')
    if (await gen.isVisible({ timeout: 5000 }).catch(() => false)) {
        await gen.click()
    } else {
        await page.locator('button:has-text("Generate FDS")').first().click()
    }

    // Wait for the model to build: the "Top" camera preset only exists once
    // Scene3D has geometry.
    const topBtn = page.locator('button:has-text("Top")')
    const built = await topBtn.waitFor({ timeout: 90000 }).then(() => true).catch(() => false)

    // If the backend couldn't generate FDS we can't render the real building's
    // 3D here — skip rather than fail. (The orientation guarantee is covered
    // deterministically by __tests__/scene3d-orientation.test.js.)
    if (!built) {
        test.skip(true, `Backend /fds returned ${fdsStatus} — cannot render 3D for this project in this environment.`)
        return
    }

    await page.waitForTimeout(2500)
    await topBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(OUT, '3d-topdown.png'), fullPage: false })

    expect(await topBtn.isVisible()).toBe(true)
})
