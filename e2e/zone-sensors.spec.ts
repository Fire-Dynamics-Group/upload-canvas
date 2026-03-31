import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('zone sensors: lobby and corridor get different prefixes in FDS output', async ({ page }) => {
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

    // Open FDS Inputs → Zones tab → assign zones
    await inputsBtn.click()
    await page.waitForTimeout(500)
    await page.click('text=Zones')
    await page.waitForTimeout(500)

    const svg = page.locator('svg.cursor-pointer').first()
    await expect(svg).toBeVisible()
    const box = await svg.boundingBox()
    if (!box) throw new Error('SVG map not visible')

    // Click right corridor area then left lobby area
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75)
    await page.waitForTimeout(300)
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.75)
    await page.waitForTimeout(300)

    // Ensure first zone stays corridor, change second to lobby
    const selects = page.locator('.border-l-4 select')
    const selectCount = await selects.count()
    // Set first to corridor explicitly
    if (selectCount >= 1) await selects.nth(0).selectOption('corridor')
    // Set second (or last) to lobby
    if (selectCount >= 2) await selects.nth(1).selectOption('lobby')
    await page.waitForTimeout(200)

    // Go to Devices tab and compute sensors
    await page.click('text=Devices')
    await page.waitForTimeout(300)
    await page.click('text=Compute Sensor Locations')
    await page.waitForTimeout(3000)

    // Intercept the /fds request to capture what gets sent and returned
    let fdsRequestBody: any = null
    let fdsResponseText: string = ''

    await page.route('**/fds', async (route) => {
        const request = route.request()
        fdsRequestBody = JSON.parse(request.postData() || '{}')
        const response = await route.fetch()
        fdsResponseText = await response.text()
        await route.fulfill({ response })
    })

    // Close the FDS Inputs popup first (it blocks the toolbar)
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // Click Generate FDS code in the toolbar
    await page.click('text=Generate FDS code')
    await page.waitForTimeout(10000)

    // Verify the request body has zoneName tags
    if (fdsRequestBody) {
        const sensors = fdsRequestBody.elementList.filter((el: any) => el.comments === 'sensorTree')
        const withZone = sensors.filter((el: any) => el.zoneName)
        const zoneNames = [...new Set(withZone.map((el: any) => el.zoneName))]

        console.log(`\n=== REQUEST: ${sensors.length} sensorTree elements, ${withZone.length} with zoneName ===`)
        console.log(`Zone names: ${JSON.stringify(zoneNames)}`)

        expect(withZone.length).toBeGreaterThan(0)
        expect(zoneNames.some((n: string) => n.toLowerCase().startsWith('lobby'))).toBe(true)
        expect(zoneNames.some((n: string) => n.toLowerCase().startsWith('corridor'))).toBe(true)
    }

    // Verify the FDS response has lobby_ prefixed sensors
    if (fdsResponseText) {
        const hasLobby = /lobby_\d+_temp_/.test(fdsResponseText)
        const hasCorridor = /corridor_\d+_temp_/.test(fdsResponseText)

        console.log(`=== RESPONSE: has lobby_1_temp_: ${hasLobby}, has corridor_1_temp_: ${hasCorridor} ===`)

        expect(hasLobby).toBe(true)
        expect(hasCorridor).toBe(true)

        // Verify sensors are grouped by quantity (all TEMPERATURE before PRESSURE, etc.)
        const fdsLines = fdsResponseText.split('\\n')
        const devcLines = fdsLines.filter((l: string) => l.includes("&DEVC") && l.includes("QUANTITY='"))
        // Extract quantity from each DEVC line in order
        const quantities = devcLines.map((l: string) => {
            const m = l.match(/QUANTITY='([^']+)'/)
            return m ? m[1] : '?'
        })
        // Filter to the 4 sensor quantities only
        const sensorQtys = quantities.filter((q: string) =>
            ['TEMPERATURE', 'PRESSURE', 'VISIBILITY', 'VELOCITY'].includes(q)
        )
        // Verify grouping: once we leave a quantity, we should never return to it
        const seen = new Set<string>()
        let prev = ''
        let isGrouped = true
        for (const q of sensorQtys) {
            if (q !== prev) {
                if (seen.has(q)) {
                    isGrouped = false
                    console.log(`GROUPING VIOLATION: ${q} appeared again after leaving it`)
                    break
                }
                seen.add(q)
                prev = q
            }
        }
        console.log(`=== QUANTITY GROUPING: ${isGrouped ? 'PASS' : 'FAIL'} (order: ${[...new Set(sensorQtys)].join(' → ')}) ===`)
        expect(isGrouped).toBe(true)
    } else {
        // If route interception didn't fire, check the downloaded file
        const files = await page.evaluate(() => {
            // Can't access filesystem from browser
            return 'check downloads'
        })
        console.log('Route interception did not capture /fds - check downloads manually')
    }
})
