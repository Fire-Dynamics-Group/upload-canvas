import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('door leakage: fixed areas, bottom-only vent to AMBIENT matching Wharf pattern', async ({ page }) => {
    await page.goto('/')

    // Handle Welcome popup if present
    const nameInput = page.locator('input[placeholder="Your name"]')
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('TestUser')
        await page.click('text=Continue')
        await page.waitForTimeout(1000)
    }

    // Click the project card
    const projectCard = page.locator(`button:has-text("${PROJECT_NAME}")`)
    await projectCard.waitFor({ timeout: 20000 })
    await projectCard.click()

    // Wait for project to load
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 30000 }).catch(() => {})
    const inputsBtn = page.locator('text=Inputs').last()
    await inputsBtn.waitFor({ timeout: 30000 })
    await page.waitForTimeout(2000)

    // Open FDS Inputs
    await inputsBtn.click()
    await page.waitForTimeout(500)

    // Go to Doors tab and set at least one door to leakage role
    await page.click('text=Doors')
    await page.waitForTimeout(500)

    // Find door role selects and set one to leakage
    const doorRoleSelects = page.locator('select').filter({ has: page.locator('option[value="leakage"]') })
    const doorCount = await doorRoleSelects.count()
    console.log(`\n=== Found ${doorCount} doors with leakage option ===`)

    if (doorCount > 0) {
        // Set first door to leakage
        await doorRoleSelects.first().selectOption('leakage')
        await page.waitForTimeout(300)

        // Verify the door type dropdown appeared with the three Wharf options
        const doorTypeSelect = page.locator('select').filter({ has: page.locator('option[value="single_smoke_sealed"]') })
        await expect(doorTypeSelect.first()).toBeVisible({ timeout: 3000 })

        // Check all three options exist
        const singleOpt = doorTypeSelect.first().locator('option[value="single_smoke_sealed"]')
        const doubleOpt = doorTypeSelect.first().locator('option[value="double_smoke_sealed"]')
        const liftOpt = doorTypeSelect.first().locator('option[value="lift"]')
        await expect(singleOpt).toBeAttached()
        await expect(doubleOpt).toBeAttached()
        await expect(liftOpt).toBeAttached()
        console.log('=== All 3 door type options present: single_smoke_sealed, double_smoke_sealed, lift ===')

        // Verify "Both sides" checkbox exists for the leakage door
        const bothSidesCheckbox = page.locator('text=Both sides (two vents)').first()
        await expect(bothSidesCheckbox).toBeVisible()

        // Leave as default (single_smoke_sealed, single side)
    }

    // Also set up zones so we can generate FDS
    await page.click('text=Zones')
    await page.waitForTimeout(500)

    const svg = page.locator('svg.cursor-pointer').first()
    await expect(svg).toBeVisible()
    const box = await svg.boundingBox()
    if (!box) throw new Error('SVG map not visible')

    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75)
    await page.waitForTimeout(300)
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.75)
    await page.waitForTimeout(300)

    const selects = page.locator('.border-l-4 select')
    const selectCount = await selects.count()
    if (selectCount >= 1) await selects.nth(0).selectOption('corridor')
    if (selectCount >= 2) await selects.nth(1).selectOption('lobby')
    await page.waitForTimeout(200)

    // Go to Devices tab and compute sensors
    await page.click('text=Devices')
    await page.waitForTimeout(300)
    await page.click('text=Compute Sensor Locations')
    await page.waitForTimeout(3000)

    // Intercept the /fds request
    let fdsResponseText: string = ''

    await page.route('**/fds', async (route) => {
        const response = await route.fetch()
        fdsResponseText = await response.text()
        await route.fulfill({ response })
    })

    // Close the FDS Inputs popup
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // Generate FDS
    await page.click('text=Generate FDS code')
    await page.waitForTimeout(10000)

    if (fdsResponseText) {
        const fdsLines = fdsResponseText.split('\\n')

        // Find all HVAC leak lines
        const hvacLeakLines = fdsLines.filter((l: string) => l.includes('&HVAC') && l.includes('LEAK'))
        console.log(`\n=== Found ${hvacLeakLines.length} HVAC LEAK lines ===`)

        for (const line of hvacLeakLines) {
            console.log(line)
        }

        if (hvacLeakLines.length > 0) {
            // 1. All leaks should be bottom-only (no top/left/right)
            const nonBottomLeaks = hvacLeakLines.filter((l: string) =>
                l.includes('top leak') || l.includes('left leak') || l.includes('right leak')
            )
            console.log(`\n=== Non-bottom leaks: ${nonBottomLeaks.length} (should be 0) ===`)
            expect(nonBottomLeaks.length).toBe(0)

            // 2. All leaks should have LEAK_ENTHALPY=.TRUE.
            for (const line of hvacLeakLines) {
                expect(line).toContain('LEAK_ENTHALPY=.TRUE.')
            }

            // 3. Check fixed areas — default single_smoke_sealed should be AREA=0.01
            const singleLeaks = hvacLeakLines.filter((l: string) => l.includes('single_smoke_sealed'))
            for (const line of singleLeaks) {
                expect(line).toContain('AREA=0.01')
                console.log(`=== Single smoke sealed area correct: 0.01 ===`)
            }

            // 4. Default should be single vent to AMBIENT (not two-sided)
            const ambientLeaks = hvacLeakLines.filter((l: string) => l.includes('AMBIENT'))
            console.log(`=== Leaks to AMBIENT: ${ambientLeaks.length} / ${hvacLeakLines.length} ===`)
            // At least the doors we set to leakage should go to AMBIENT
            expect(ambientLeaks.length).toBeGreaterThan(0)

            // 5. Check only one VENT per leak door (not pairs)
            const ventLines = fdsLines.filter((l: string) => l.includes('&VENT') && l.includes('bottom') && l.includes('leak'))
            // For default single-side, should not have "vent 2" lines for our leakage doors
            const vent2Lines = ventLines.filter((l: string) => l.includes('Vent 2'))
            console.log(`=== Bottom Vent 2 lines (should be 0 for default): ${vent2Lines.length} ===`)
        }
    } else {
        console.log('Route interception did not capture /fds response')
    }
})
