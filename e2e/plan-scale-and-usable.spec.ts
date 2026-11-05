import { test, expect } from '@playwright/test'
import path from 'path'

test.use({ channel: process.env.EFS_TEST_BROWSER || 'chrome', viewport: { width: 1440, height: 900 } })

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)

test.describe('Plan visibility, scale tool availability and usability', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('upload-canvas-username', 'Dev'))
    })

    test('reopened project with tiny scale does not turn black from gridlines', async ({ page }) => {
        await page.route('**/projects**', async (route) => {
            const method = route.request().method()
            if (method === 'GET') {
                await route.fulfill({ json: [] })
                return
            }
            if (method === 'POST') {
                await route.fulfill({
                    json: {
                        id: 'proj-scale-test',
                        name: 'Scale Test',
                        mode: 'timeEq',
                        floors: [{ id: 'floor-scale', floor_number: 0, name: 'Compartment' }],
                    },
                })
                return
            }
            await route.fulfill({ json: {} })
        })

        await page.goto('/')
        await page.getByRole('button', { name: 'Time Equivalence' }).click()

        const newBtn = page.getByRole('button', { name: '+ New Project' })
        await expect(newBtn).toBeVisible()
        await newBtn.click()

        const nameInput = page.getByPlaceholder('Project name')
        if (await nameInput.isVisible()) {
            await nameInput.fill('Scale Test')
            await page.getByRole('button', { name: 'Create', exact: true }).click()
        }

        const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
        await expect(fileInput).toBeAttached()
        await fileInput.setInputFiles(FIXTURE)

        // Wait for drawing canvas
        const drawingCanvas = page.locator('canvas.z-10')
        await expect(drawingCanvas).toBeVisible({ timeout: 25000 })

        // Simulate tiny pixels_per_mesh (like the 0.0084384 corrupt scale)
        await page.evaluate(() => {
            const store = (window as any).__useStore || (window as any).__store
            if (store) {
                store.getState().setPixelsPerMesh(0.008438425875126237)
            }
        })

        await page.waitForTimeout(1500)

        // Grid canvas must NOT have thousands of black lines turning it solid black
        const gridCheck = await page.evaluate(() => {
            const canvas = document.querySelector('canvas[class*="z-[5]"]') as HTMLCanvasElement | null
            if (!canvas) return { hasCanvas: false, blackRatio: 0 }
            const ctx = canvas.getContext('2d')
            if (!ctx) return { hasCanvas: true, blackRatio: 0 }
            const cx = Math.floor(canvas.width / 2)
            const cy = Math.floor(canvas.height / 2)
            const data = ctx.getImageData(cx, cy, 30, 30).data
            let blackPixels = 0
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 200 && data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50) {
                    blackPixels++
                }
            }
            return {
                hasCanvas: true,
                blackRatio: blackPixels / (data.length / 4),
            }
        })

        expect(gridCheck.blackRatio).toBeLessThan(0.1)
    })

    test('toolbar provides Scale tool in timeEq mode, allows calibrating scale and drawing compartment', async ({ page }) => {
        await page.route('**/projects**', async (route) => {
            const method = route.request().method()
            if (method === 'GET') {
                await route.fulfill({ json: [] })
                return
            }
            if (method === 'POST') {
                await route.fulfill({
                    json: {
                        id: 'proj-scale-test-2',
                        name: 'Scale Test 2',
                        mode: 'timeEq',
                        floors: [{ id: 'floor-scale-2', floor_number: 0, name: 'Compartment' }],
                    },
                })
                return
            }
            await route.fulfill({ json: {} })
        })

        await page.goto('/')
        await page.getByRole('button', { name: 'Time Equivalence' }).click()

        const newBtn = page.getByRole('button', { name: '+ New Project' })
        await expect(newBtn).toBeVisible()
        await newBtn.click()

        const nameInput = page.getByPlaceholder('Project name')
        if (await nameInput.isVisible()) {
            await nameInput.fill('Scale Test 2')
            await page.getByRole('button', { name: 'Create', exact: true }).click()
        }

        const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
        await expect(fileInput).toBeAttached()
        await fileInput.setInputFiles(FIXTURE)

        const drawingCanvas = page.locator('canvas.z-10')
        await expect(drawingCanvas).toBeVisible({ timeout: 25000 })

        // Toolbar MUST have a Scale radio tool
        const scaleRadio = page.locator('input#scale[type="radio"]')
        await expect(scaleRadio).toBeVisible({ timeout: 5000 })

        // Click scale tool
        await scaleRadio.click()
        await expect(scaleRadio).toBeChecked()

        // Calibrate scale: click 2 points on canvas
        const box = (await drawingCanvas.boundingBox())!
        await page.mouse.click(box.x + 200, box.y + 200)
        await page.mouse.click(box.x + 400, box.y + 200)

        // Scale popup must appear
        const popup = page.getByText('Enter Length of Line (m)')
        await expect(popup).toBeVisible()

        // Enter length and submit
        await page.getByPlaceholder('Enter scale line length (m)').fill('10')
        await page.getByRole('button', { name: 'Enter' }).click()

        // Scale popup closes
        await expect(popup).toHaveCount(0)

        // Store pixelsPerMesh must be updated to a valid positive number
        const ppm = await page.evaluate(() => {
            const store = (window as any).__useStore || (window as any).__store
            return store.getState().pixelsPerMesh
        })
        expect(ppm).toBeGreaterThan(1)

        // Obstruction tool should be selectable
        const obsRadio = page.locator('input#line[type="radio"], input#obstruction[type="radio"]').first()
        await expect(obsRadio).toBeVisible()
        await obsRadio.click()

        // Click Run Calc button in toolbar with no elements
        const runCalcBtn = page.getByRole('button', { name: 'Run Calc' })
        await expect(runCalcBtn).toBeVisible()
        await runCalcBtn.click()

        // Shows clear error requiring a compartment obstruction
        await expect(page.getByText('please draw a compartment obstruction')).toBeVisible()
        await page.getByRole('button', { name: 'Enter' }).click()

        // Set compartment polygon in elements
        await page.evaluate(() => {
            const store = (window as any).__useStore || (window as any).__store
            store.setState({
                elements: [
                    {
                        id: 1,
                        type: 'polyline',
                        comments: 'obstruction',
                        points: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 100 }],
                    },
                ],
            })
        })

        // Click Run Calc with drawn compartment
        await runCalcBtn.click()

        // Time Equivalence popup opens
        await expect(page.getByText('Select Floor Material:')).toBeVisible()
    })

    test('reopening an unscaled project keeps scale tool active so plan is calibrated', async ({ page }) => {
        await page.route('**/projects**', async (route) => {
            const url = route.request().url()
            const method = route.request().method()
            if (url.includes('/macs-runs')) {
                await route.fulfill({ json: [] })
                return
            }
            if (url.includes('/floors/') && url.endsWith('/pdf')) {
                await route.fulfill({ json: { url: 'blob:test' } })
                return
            }
            if (url.includes('/floors/')) {
                await route.fulfill({
                    json: {
                        id: 'floor-unscaled',
                        floor_number: 0,
                        name: 'Compartment',
                        canvas_dimensions: { width: 3576, height: 2526 },
                        pixels_per_mesh: 1.0, // Uncalibrated default
                        elements: [],
                        settings: {},
                    },
                })
                return
            }
            if (method === 'GET' && !url.includes('/floors')) {
                await route.fulfill({
                    json: [
                        {
                            id: 'proj-unscaled',
                            name: 'Unscaled MACS Run',
                            mode: 'timeEq',
                            floors: [{ id: 'floor-unscaled', floor_number: 0, name: 'Compartment' }],
                            settings: {},
                        },
                    ],
                })
                return
            }
            await route.fulfill({ json: {} })
        })

        await page.goto('/')
        await page.getByRole('button', { name: 'Time Equivalence' }).click()

        const projectCard = page.locator('text="Unscaled MACS Run"').first()
        await expect(projectCard).toBeVisible()
        await projectCard.click()

        // Because pixels_per_mesh is 1.0 (uncalibrated), the active tool must be 'scale'
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const store = (window as any).__useStore || (window as any).__store
                return store?.getState().tool
            })
        }).toBe('scale')
    })

    test('deep-link ?project=<id> directly opens the project in timeEq mode', async ({ page }) => {
        await page.route('**/projects**', async (route) => {
            const url = route.request().url()
            const method = route.request().method()
            if (url.includes('/macs-runs')) {
                await route.fulfill({ json: [] })
                return
            }
            if (url.includes('/floors/') && url.endsWith('/pdf')) {
                await route.fulfill({ json: { url: 'blob:test' } })
                return
            }
            if (url.includes('/floors/')) {
                await route.fulfill({
                    json: {
                        id: 'floor-p1',
                        floor_number: 0,
                        name: 'Compartment',
                        canvas_dimensions: { width: 3576, height: 2526 },
                        pixels_per_mesh: 50.0,
                        elements: [],
                        settings: {},
                    },
                })
                return
            }
            if (url.includes('/projects/proj-direct')) {
                await route.fulfill({
                    json: {
                        id: 'proj-direct',
                        name: 'Direct Opened Project',
                        mode: 'timeEq',
                        floors: [{ id: 'floor-p1', floor_number: 0, name: 'Compartment', pdf_s3_key: 'pdf-key' }],
                        settings: {},
                    },
                })
                return
            }
            if (method === 'GET') {
                await route.fulfill({
                    json: [
                        {
                            id: 'proj-direct',
                            name: 'Direct Opened Project',
                            mode: 'timeEq',
                            floors: [{ id: 'floor-p1', floor_number: 0, name: 'Compartment' }],
                            settings: {},
                        },
                    ],
                })
                return
            }
            await route.fulfill({ json: {} })
        })

        await page.goto('/?project=proj-direct')

        // Must switch to timeEq mode and load the project
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const store = (window as any).__useStore || (window as any).__store
                return {
                    projectId: store?.getState().projectId,
                    projectName: store?.getState().projectName,
                    currentMode: store?.getState().currentMode,
                }
            })
        }, { timeout: 5000 }).toEqual({
            projectId: 'proj-direct',
            projectName: 'Direct Opened Project',
            currentMode: 'timeEq',
        })
    })
})
