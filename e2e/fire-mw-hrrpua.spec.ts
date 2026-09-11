import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('fire MW+HRRPUA mode: 2.5MW at 445 kW/m² produces correct FDS fire lines', async ({ page }) => {
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

    // Navigate to Fire tab
    await page.click('text=Fire')
    await page.waitForTimeout(500)

    // === Switch to MW + HRRPUA mode ===
    const mwHrrpuaRadio = page.locator('input[name="fireInputMode"][value="mw_hrrpua"]')
    await mwHrrpuaRadio.waitFor({ timeout: 5000 })
    await mwHrrpuaRadio.click()
    await page.waitForTimeout(300)

    // Set Total HRR to 2.5 MW
    const mwInput = page.locator('input[placeholder="e.g. 2.5"]')
    await expect(mwInput).toBeVisible({ timeout: 3000 })
    await mwInput.fill('2.5')
    await page.waitForTimeout(300)

    // Set HRRPUA to 445
    const hrrpuaInput = page.locator('input[placeholder="e.g. 445"]')
    await expect(hrrpuaInput).toBeVisible({ timeout: 3000 })
    await hrrpuaInput.fill('445')
    await page.waitForTimeout(300)

    // Verify the calculated dimension is shown
    const calcText = page.locator('text=/Calculated dimension:/')
    await expect(calcText).toBeVisible()
    const calcContent = await calcText.textContent()
    console.log(`\n=== ${calcContent} ===`)

    // Verify actual HRRPUA text
    const actualHrrpuaText = page.locator('text=/Actual HRRPUA:/')
    await expect(actualHrrpuaText).toBeVisible()
    const hrrpuaContent = await actualHrrpuaText.textContent()
    console.log(`=== ${hrrpuaContent} ===`)

    // Close the popup
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // Intercept the /fds request
    let fdsRequestBody: any = null
    let fdsResponseText: string = ''

    await page.route('**/fds', async (route) => {
        const request = route.request()
        fdsRequestBody = JSON.parse(request.postData() || '{}')
        const response = await route.fetch()
        fdsResponseText = await response.text()
        await route.fulfill({ response })
    })

    // Generate FDS
    await page.click('text=Generate FDS code')
    await page.waitForTimeout(15000)

    // === VERIFY REQUEST PAYLOAD ===
    expect(fdsRequestBody).toBeTruthy()
    console.log(`\n=== REQUEST fire_hrr: ${fdsRequestBody.fire_hrr} kW ===`)
    console.log(`=== REQUEST fire_dimension: ${fdsRequestBody.fire_dimension} m ===`)

    // fire_hrr should be 2500 kW (2.5 MW)
    expect(fdsRequestBody.fire_hrr).toBe(2500)

    // fire_dimension should be sqrt(2500/445) ≈ 2.37
    const expectedDim = parseFloat(Math.sqrt(2500 / 445).toFixed(2))
    expect(fdsRequestBody.fire_dimension).toBeCloseTo(expectedDim, 1)

    // HRRPUA should be close to 445
    const actualHRRPUA = fdsRequestBody.fire_hrr / (fdsRequestBody.fire_dimension ** 2)
    console.log(`=== Actual HRRPUA from payload: ${actualHRRPUA.toFixed(1)} kW/m² ===`)
    expect(actualHRRPUA).toBeGreaterThan(400)
    expect(actualHRRPUA).toBeLessThan(500)

    // === VERIFY FDS OUTPUT ===
    expect(fdsResponseText.length).toBeGreaterThan(0)

    let fdsContent = fdsResponseText
    try {
        fdsContent = JSON.parse(fdsResponseText)
    } catch {
        // already a string
    }
    const fdsLines = fdsContent.split('\n')

    // Find SURF line for fire — should contain HRRPUA
    const surfFireLines = fdsLines.filter((l: string) => l.includes('&SURF') && l.toLowerCase().includes('fire'))
    console.log(`\n=== SURF fire lines (${surfFireLines.length}): ===`)
    surfFireLines.forEach((l: string) => console.log(`  ${l.trim()}`))

    expect(surfFireLines.length).toBeGreaterThan(0)

    // Extract HRRPUA value from SURF line
    const hrrpuaMatch = surfFireLines[0].match(/HRRPUA\s*=\s*([\d.]+)/)
    if (hrrpuaMatch) {
        const fdsHRRPUA = parseFloat(hrrpuaMatch[1])
        console.log(`=== FDS HRRPUA: ${fdsHRRPUA} kW/m² ===`)
        // Should be close to 445
        expect(fdsHRRPUA).toBeGreaterThan(400)
        expect(fdsHRRPUA).toBeLessThan(500)
    }

    // Find fire OBST or VENT with fire dimensions
    const fireObstLines = fdsLines.filter((l: string) =>
        (l.includes('&OBST') || l.includes('&VENT')) && l.toLowerCase().includes('fire')
    )
    console.log(`\n=== Fire OBST/VENT lines (${fireObstLines.length}): ===`)
    fireObstLines.forEach((l: string) => console.log(`  ${l.trim()}`))

    // Find RAMP lines for fire growth
    const rampFireLines = fdsLines.filter((l: string) => l.includes('&RAMP') && l.toLowerCase().includes('fire'))
    console.log(`\n=== RAMP fire lines (${rampFireLines.length}): ===`)
    rampFireLines.forEach((l: string) => console.log(`  ${l.trim()}`))

    console.log(`\n=== FIRE MW+HRRPUA TEST: PASS ===`)
    console.log(`  2.5 MW fire at ~445 kW/m², dimension=${fdsRequestBody.fire_dimension}m`)
})
