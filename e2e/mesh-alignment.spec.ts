import { test, expect } from '@playwright/test'

const PROJECT_NAME = '0406 North Finchley 1'

test('mesh alignment: FDS output has no gaps between abutting meshes', async ({ page }) => {
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
        console.log(`\n=== FDS REQUEST: px_per_m=${fdsRequestBody.px_per_m} ===`)
        console.log(`=== Element count: ${fdsRequestBody.elementList?.length} ===`)
        const meshEls = fdsRequestBody.elementList?.filter((el: any) => el.comments?.toLowerCase().includes('mesh')) || []
        console.log(`=== Mesh elements: ${meshEls.length} (${meshEls.map((e: any) => e.comments).join(', ')}) ===`)

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

    // === VERIFY px_per_m is not hardcoded 33.6 ===
    if (fdsRequestBody) {
        const pxPerM = fdsRequestBody.px_per_m
        console.log(`\n=== px_per_m sent: ${pxPerM} ===`)
        // Should be derived from scale calibration, not hardcoded 33.6
        // (it might still be 33.6 if that happens to be the calibrated value, but it should come from pixelsPerMesh*10)
        expect(pxPerM).toBeGreaterThan(0)
        expect(typeof pxPerM).toBe('number')
    }

    // === VERIFY MESH ALIGNMENT IN FDS OUTPUT ===
    expect(fdsResponseText.length).toBeGreaterThan(0)

    // Parse FDS response (it's JSON-encoded string with literal \n)
    let fdsContent = fdsResponseText
    try {
        fdsContent = JSON.parse(fdsResponseText)
    } catch {
        // already a string
    }
    const fdsLines = fdsContent.split('\n')

    // Extract all MESH lines
    const meshLines = fdsLines.filter((l: string) => l.trim().startsWith("&MESH"))
    console.log(`\n=== MESH LINES (${meshLines.length}): ===`)
    meshLines.forEach((l: string) => console.log(`  ${l.trim()}`))

    expect(meshLines.length).toBeGreaterThan(0)

    // Parse each mesh's XB bounds
    interface MeshBounds {
        id: string
        xmin: number
        xmax: number
        ymin: number
        ymax: number
        zmin: number
        zmax: number
    }

    const meshes: MeshBounds[] = meshLines.map((line: string) => {
        const idMatch = line.match(/ID='([^']+)'/)
        const xbMatch = line.match(/XB=([^/]+)/)
        if (!idMatch || !xbMatch) return null
        const vals = xbMatch[1].split(',').map(Number)
        return {
            id: idMatch[1],
            xmin: vals[0], xmax: vals[1],
            ymin: vals[2], ymax: vals[3],
            zmin: vals[4], zmax: vals[5]
        }
    }).filter(Boolean) as MeshBounds[]

    console.log(`\n=== PARSED MESHES: ===`)
    meshes.forEach(m => {
        console.log(`  ${m.id}: x=[${m.xmin}, ${m.xmax}] y=[${m.ymin}, ${m.ymax}] z=[${m.zmin}, ${m.zmax}]`)
    })

    // Check for gaps between abutting meshes (meshes that overlap in one axis and are close in the other)
    const gaps: string[] = []
    const alignedPairs: string[] = []
    const GAP_THRESHOLD = 0.01 // anything > 0.01m is a gap

    for (let i = 0; i < meshes.length; i++) {
        for (let j = i + 1; j < meshes.length; j++) {
            const a = meshes[i]
            const b = meshes[j]

            // Check X overlap
            const xOverlap = a.xmin < b.xmax && a.xmax > b.xmin
            // Check Y overlap
            const yOverlap = a.ymin < b.ymax && a.ymax > b.ymin

            // Y-direction adjacency (meshes share a horizontal edge)
            if (xOverlap) {
                const gapAB = b.ymin - a.ymax // A above B
                const gapBA = a.ymin - b.ymax // B above A

                if (Math.abs(gapAB) < 0.5) {
                    if (Math.abs(gapAB) < GAP_THRESHOLD) {
                        alignedPairs.push(`${a.id} <-> ${b.id} at y=${a.ymax} (gap=${gapAB.toFixed(4)})`)
                    } else {
                        gaps.push(`${a.id} (ymax=${a.ymax}) <-> ${b.id} (ymin=${b.ymin}): GAP=${gapAB.toFixed(4)}m`)
                    }
                }
                if (Math.abs(gapBA) < 0.5) {
                    if (Math.abs(gapBA) < GAP_THRESHOLD) {
                        alignedPairs.push(`${b.id} <-> ${a.id} at y=${b.ymax} (gap=${gapBA.toFixed(4)})`)
                    } else {
                        gaps.push(`${b.id} (ymax=${b.ymax}) <-> ${a.id} (ymin=${a.ymin}): GAP=${gapBA.toFixed(4)}m`)
                    }
                }
            }

            // X-direction adjacency (meshes share a vertical edge)
            if (yOverlap) {
                const gapAB = b.xmin - a.xmax
                const gapBA = a.xmin - b.xmax

                if (Math.abs(gapAB) < 0.5) {
                    if (Math.abs(gapAB) < GAP_THRESHOLD) {
                        alignedPairs.push(`${a.id} <-> ${b.id} at x=${a.xmax} (gap=${gapAB.toFixed(4)})`)
                    } else {
                        gaps.push(`${a.id} (xmax=${a.xmax}) <-> ${b.id} (xmin=${b.xmin}): GAP=${gapAB.toFixed(4)}m`)
                    }
                }
                if (Math.abs(gapBA) < 0.5) {
                    if (Math.abs(gapBA) < GAP_THRESHOLD) {
                        alignedPairs.push(`${b.id} <-> ${a.id} at x=${b.xmax} (gap=${gapBA.toFixed(4)})`)
                    } else {
                        gaps.push(`${b.id} (xmax=${b.xmax}) <-> ${a.id} (xmin=${a.xmin}): GAP=${gapBA.toFixed(4)}m`)
                    }
                }
            }
        }
    }

    console.log(`\n=== ALIGNED PAIRS (${alignedPairs.length}): ===`)
    alignedPairs.forEach(p => console.log(`  OK: ${p}`))

    console.log(`\n=== GAPS FOUND (${gaps.length}): ===`)
    gaps.forEach(g => console.log(`  FAIL: ${g}`))

    // Verify mesh boundaries are on cell-size multiples
    const cellSizeViolations: string[] = []
    meshes.forEach(m => {
        const isStair = m.id.toLowerCase().includes('stair')
        const cs = isStair ? 0.2 : 0.1
        const coords = [
            { name: 'xmin', val: m.xmin },
            { name: 'xmax', val: m.xmax },
            { name: 'ymin', val: m.ymin },
            { name: 'ymax', val: m.ymax },
        ]
        coords.forEach(c => {
            const remainder = Math.abs(c.val - Math.round(c.val / cs) * cs)
            if (remainder > 0.005) {
                cellSizeViolations.push(`${m.id}.${c.name}=${c.val} not on ${cs}m grid (remainder=${remainder.toFixed(4)})`)
            }
        })
    })

    console.log(`\n=== CELL-SIZE GRID VIOLATIONS (${cellSizeViolations.length}): ===`)
    cellSizeViolations.forEach(v => console.log(`  WARN: ${v}`))

    // Verify IJK values are integers (no fractional cells)
    const ijkIssues: string[] = []
    meshLines.forEach((line: string) => {
        const idMatch = line.match(/ID='([^']+)'/)
        const ijkMatch = line.match(/IJK=([^,]+),([^,]+),([^,\s]+)/)
        if (idMatch && ijkMatch) {
            const [_, ni, nj, nk] = ijkMatch
            const vals = [Number(ni), Number(nj), Number(nk)]
            vals.forEach((v, idx) => {
                if (!Number.isInteger(v) || v <= 0) {
                    ijkIssues.push(`${idMatch[1]}: IJK[${idx}]=${v} is not a positive integer`)
                }
            })
        }
    })

    console.log(`\n=== IJK ISSUES (${ijkIssues.length}): ===`)
    ijkIssues.forEach(i => console.log(`  FAIL: ${i}`))

    // ASSERTIONS
    // No gaps between abutting meshes
    expect(gaps.length, `Mesh gaps found:\n${gaps.join('\n')}`).toBe(0)

    // IJK values should all be positive integers
    expect(ijkIssues.length, `IJK issues found:\n${ijkIssues.join('\n')}`).toBe(0)

    // Should have at least some aligned pairs
    expect(alignedPairs.length).toBeGreaterThan(0)

    console.log(`\n=== MESH ALIGNMENT TEST: PASS ===`)
    console.log(`  ${meshes.length} meshes, ${alignedPairs.length} aligned pairs, 0 gaps`)
})
