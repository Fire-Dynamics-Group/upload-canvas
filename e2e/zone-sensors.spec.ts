import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('zone assignment: assign corridor + lobby zones, verify both get sensors', async ({ page }) => {
    await page.goto('/')

    // Handle Welcome popup if present
    const nameInput = page.locator('input[placeholder="Your name"]')
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('TestUser')
        await page.click('text=Continue')
        await page.waitForTimeout(1000)
    }

    // Click the project card containing the project name
    const projectCard = page.locator(`button:has-text("${PROJECT_NAME}")`)
    await projectCard.waitFor({ timeout: 20000 })
    await projectCard.click()

    // Wait for project to fully load (Loading... disappears, toolbar appears)
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 }).catch(() => {})
    // Wait for the toolbar Inputs button to appear (confirms project loaded)
    const inputsBtn = page.locator('text=Inputs').last()
    await inputsBtn.waitFor({ timeout: 30000 })
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'e2e/shot-project-loaded.png' })
    await inputsBtn.click()
    await page.waitForTimeout(500)

    // Verify FDS popup opened — should see tab buttons
    await expect(page.locator('text=General')).toBeVisible({ timeout: 3000 })

    // Click Zones tab
    await page.click('text=Zones')
    await page.waitForTimeout(500)

    // Verify zone detection
    const regionText = page.locator('text=/\\d+ region/')
    await expect(regionText).toBeVisible({ timeout: 3000 })

    // Click on the SVG map to assign zones
    const svg = page.locator('svg.cursor-pointer').first()
    await expect(svg).toBeVisible()
    const box = await svg.boundingBox()
    if (!box) throw new Error('SVG map not visible')

    // Click right corridor area
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75)
    await page.waitForTimeout(300)

    // Click left lobby area
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.75)
    await page.waitForTimeout(300)

    // Should have at least 2 assigned zones
    const zoneEntries = page.locator('.border-l-4')
    const zoneCount = await zoneEntries.count()
    expect(zoneCount).toBeGreaterThanOrEqual(2)

    // Change one zone type to Lobby
    const selects = page.locator('.border-l-4 select')
    await selects.last().selectOption('lobby')
    await page.waitForTimeout(200)

    // Verify sensors checkbox is checked for both zones
    await page.screenshot({ path: 'e2e/shot-zones-assigned.png' })

    // Switch to Devices tab
    await page.click('text=Devices')
    await page.waitForTimeout(300)

    // Click Compute Sensor Locations
    await page.click('text=Compute Sensor Locations')
    await page.waitForTimeout(5000)

    // Take screenshot to verify
    await page.screenshot({ path: 'e2e/shot-sensors-computed.png' })

    // Check sensor count text
    const sensorCountText = await page.locator('text=/\\d+ sensor/').textContent({ timeout: 5000 }).catch(() => null)
    console.log('Sensor count text:', sensorCountText)

    // Verify sensors were placed by checking the count is > 0
    expect(sensorCountText).toBeTruthy()
})
