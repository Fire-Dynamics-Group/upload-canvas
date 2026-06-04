import { test, expect } from '@playwright/test'

// Optional escape hatch: point at a specific chromium binary via PW_CHROME.
// Left undefined in normal runs, where Playwright uses its installed browser.
if (process.env.PW_CHROME) {
    test.use({ launchOptions: { executablePath: process.env.PW_CHROME } })
}

// Reproduces: a non-DB mode (radiation/timeEq) inheriting the PDF + scale from a
// previous session. The PDF/scale live in global store fields, so switching
// modes used to carry them over — you'd open a fresh mode and the plan + scale
// were "already there". Non-DB modes must start clean.
//
// We seed the leftover state (as a prior session would leave it in memory),
// then switch mode via the REAL dashboard button (handleModeClick ->
// setCurrentMode) and assert the shared canvas state was reset. No backend
// needed — the non-DB path makes no API calls and the dashboard tolerates an
// empty/failed project list.
test('switching into a non-DB mode clears the leftover PDF + scale', async ({ page }) => {
    await page.goto('/')

    // Welcome popup (first visit)
    const nameInput = page.locator('input[placeholder="Your name"]')
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill('TestUser')
        await page.click('text=Continue')
    }

    // Dashboard renders even if the project list fails to load.
    await page.waitForFunction(() => Boolean((window as any).__useStore), null, { timeout: 30000 })

    // Seed leftover PDF + scale, as a prior fdsGen session would leave in memory.
    await page.evaluate(() => {
        (window as any).__useStore.setState({
            currentMode: 'fdsGen',
            pdfData: { coloured: 'x', greyscaled: 'y' },
            pdfIsGreyscale: true,
            pixelsPerMesh: 7,
            canvasDimensions: { width: 800, height: 600 },
            convertedPoints: [{ x: 1, y: 2 }],
            originPixels: { x: 10, y: 20 },
            hasDoor: true,
            tool: 'obstruction',
        })
    })

    // The user's action: change mode (here via the dashboard mode switcher).
    await page.click('button:has-text("Radiation")')

    // The plan + scale must NOT have carried over into the non-DB mode.
    const state = await page.evaluate(() => {
        const s = (window as any).__useStore.getState()
        return {
            currentMode: s.currentMode,
            pdfData: s.pdfData,
            pdfIsGreyscale: s.pdfIsGreyscale,
            pixelsPerMesh: s.pixelsPerMesh,
            canvasDimensions: s.canvasDimensions,
            convertedPoints: s.convertedPoints,
            originPixels: s.originPixels,
            hasDoor: s.hasDoor,
            tool: s.tool,
        }
    })

    expect(state.currentMode).toBe('radiation')
    expect(state.pdfData).toBeNull()
    expect(state.pdfIsGreyscale).toBe(false)
    expect(state.pixelsPerMesh).toBe(1)
    expect(state.canvasDimensions).toEqual({})
    expect(state.convertedPoints).toEqual([])
    expect(state.originPixels).toBeNull()
    expect(state.hasDoor).toBe(false)
    expect(state.tool).toBe('scale') // ready to calibrate the next upload
})
