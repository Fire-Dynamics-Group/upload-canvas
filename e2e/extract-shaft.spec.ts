import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('mechanical extract shaft: FDS output matches Crown Wharf pattern', async ({ page }) => {
    test.setTimeout(120000)
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

    // Intercept the /fds request to capture request and response
    let fdsRequestBody: any = null
    let fdsResponseText: string = ''

    await page.route('**/fds', async (route) => {
        const request = route.request()
        fdsRequestBody = JSON.parse(request.postData() || '{}')
        const response = await route.fetch()
        fdsResponseText = await response.text()
        await route.fulfill({ response })
    })

    // Close the FDS Inputs popup if it's open, then click Generate FDS code
    const enterBtn = page.locator('button:has-text("Enter")')
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
        await page.waitForTimeout(500)
    }

    // Click Generate FDS code in the toolbar
    await page.click('text=Generate FDS code')
    await page.waitForTimeout(15000)

    // Parse FDS output
    expect(fdsResponseText.length).toBeGreaterThan(0)
    let fdsContent = fdsResponseText
    try { fdsContent = JSON.parse(fdsResponseText) } catch { /* already a string */ }
    const fdsLines: string[] = fdsContent.split('\n')

    // Find extract shaft lines
    const shaftMeshes = fdsLines.filter((l: string) => l.includes('Extract_Shaft'))
    const extractSurfs = fdsLines.filter((l: string) => l.includes("&SURF") && l.includes("Extract_"))
    const extractVents = fdsLines.filter((l: string) => l.includes("&VENT") && l.includes("Extract_"))
    const wallHoles = fdsLines.filter((l: string) => l.includes("Extract Wall Hole"))
    const shaftWalls = fdsLines.filter((l: string) => l.includes("Shaft Wall"))
    const shaftDampers = fdsLines.filter((l: string) => l.includes("Shaft Damper"))

    console.log('\n=== EXTRACT SHAFT LINES ===')
    console.log('Shaft meshes:', shaftMeshes.length)
    shaftMeshes.forEach((l: string) => console.log(`  ${l.trim()}`))
    console.log('Extract SURFs:', extractSurfs.length)
    extractSurfs.forEach((l: string) => console.log(`  ${l.trim()}`))
    console.log('Extract VENTs:', extractVents.length)
    extractVents.forEach((l: string) => console.log(`  ${l.trim()}`))
    console.log('Wall holes:', wallHoles.length)
    wallHoles.forEach((l: string) => console.log(`  ${l.trim()}`))
    console.log('Shaft walls:', shaftWalls.length)
    shaftWalls.forEach((l: string) => console.log(`  ${l.trim()}`))
    console.log('Shaft dampers:', shaftDampers.length)
    shaftDampers.forEach((l: string) => console.log(`  ${l.trim()}`))

    // Find mechanical shafts (have a SURF with VOLUME_FLOW)
    const mechSurfs = extractSurfs.filter((l: string) => l.includes('VOLUME_FLOW'))

    // === MECHANICAL SHAFT CHECKS ===
    if (mechSurfs.length > 0) {
        console.log('\n=== MECHANICAL SHAFT VERIFICATION ===')

        // 1. SURF has HEAT_TRANSFER_COEFFICIENT=0.0
        for (const surf of mechSurfs) {
            expect(surf).toContain('HEAT_TRANSFER_COEFFICIENT=0.0')
            console.log('  PASS: SURF has HEAT_TRANSFER_COEFFICIENT=0.0')
        }

        // 2. No corridor-level extract vent (no "Extract Opening" for mechanical)
        const corridorVents = fdsLines.filter((l: string) => l.includes("Extract Opening"))
        // Only natural shafts should have "Extract Opening" — count should equal number of natural shafts
        const naturalShaftCount = shaftMeshes.length - mechSurfs.length
        expect(corridorVents.length).toBe(naturalShaftCount)
        console.log(`  PASS: No corridor-level "Extract Opening" for mechanical (${corridorVents.length} for ${naturalShaftCount} natural shafts)`)

        // 3. No "Extract Roof Opening" HOLE for mechanical
        const roofHoles = fdsLines.filter((l: string) => l.includes("Extract Roof Opening"))
        expect(roofHoles.length).toBe(naturalShaftCount)
        console.log(`  PASS: No roof holes for mechanical (${roofHoles.length} for ${naturalShaftCount} natural shafts)`)

        // 4. Fan VENT at ZMAX uses Extract SURF (not OPEN)
        for (const surf of mechSurfs) {
            const surfIdMatch = surf.match(/ID='([^']+)'/)
            if (surfIdMatch) {
                const surfId = surfIdMatch[1]
                const fanVent = extractVents.find((l: string) => l.includes(`SURF_ID='${surfId}'`))
                expect(fanVent).toBeTruthy()
                // Verify it's at ZMAX (last two XB values should be equal)
                const xbMatch = fanVent!.match(/XB=([^/]+)/)
                if (xbMatch) {
                    const vals = xbMatch[1].split(',').map(Number)
                    expect(vals[4]).toBe(vals[5]) // zmin == zmax means it's a face
                    console.log(`  PASS: Fan VENT for ${surfId} at ZMAX=${vals[4]}`)
                }
            }
        }

        // 5. HOLE exists to remove corridor wall
        expect(wallHoles.length).toBeGreaterThanOrEqual(mechSurfs.length)
        console.log(`  PASS: ${wallHoles.length} wall holes for ${mechSurfs.length} mechanical shafts`)

        // 6. Opening dimensions should match defaults (base=0.9, height=1.3)
        // Check that shaft walls exist (below and/or above the opening)
        expect(shaftWalls.length).toBeGreaterThan(0)
        console.log(`  PASS: ${shaftWalls.length} shaft wall OBSTs found`)

        // 7. For always_open: no damper, no CTRL
        // Check extract_config from request
        if (fdsRequestBody?.extract_config) {
            const configs = Object.values(fdsRequestBody.extract_config) as any[]
            const alwaysOpenMech = configs.filter((c: any) => c.type === 'mechanical' && (c.activation === 'always_open' || !c.activation))
            if (alwaysOpenMech.length > 0) {
                expect(shaftDampers.length).toBe(0)
                const ctrls = fdsLines.filter((l: string) => l.includes("Extract_CTRL"))
                expect(ctrls.length).toBe(0)
                console.log('  PASS: always_open mechanical — no damper OBSTs, no CTRLs')
            }
        }

        // 8. No OPEN vent at ZMAX for mechanical shafts
        // Find ZMAX vents that use OPEN — should only be for natural/stair
        const openZmaxVents = fdsLines.filter((l: string) =>
            l.includes("SURF_ID='OPEN'") && l.includes("Extract_Shaft")
        )
        expect(openZmaxVents.length).toBe(0)
        console.log('  PASS: No OPEN vents referencing Extract_Shaft meshes')
    }

    // === VERIFY OPENING DIMENSIONS ARE NOT FULL WALL HEIGHT ===
    // The opening should be ~1.3m, not the full wall height
    if (shaftWalls.length > 0) {
        console.log('\n=== OPENING DIMENSION CHECK ===')
        // Parse Z ranges from shaft walls to infer opening position
        const zRanges = shaftWalls.map((l: string) => {
            const xbMatch = l.match(/XB=([^/]+)/)
            if (!xbMatch) return null
            const vals = xbMatch[1].split(',').map(Number)
            return { zmin: vals[4], zmax: vals[5] }
        }).filter(Boolean) as { zmin: number, zmax: number }[]

        // The wall height from request
        const wallHeight = fdsRequestBody?.wall_height || 2.4
        const z = fdsRequestBody?.z || 3.1

        // Check that the shaft walls don't span the full wall height
        // (if they did, there would be no opening)
        for (const range of zRanges) {
            const height = range.zmax - range.zmin
            console.log(`  Shaft wall: z=${range.zmin} to ${range.zmax} (${height.toFixed(2)}m)`)
            expect(height).toBeLessThan(wallHeight)
        }
        console.log('  PASS: Shaft walls are shorter than full wall height (opening exists)')
    }
})
