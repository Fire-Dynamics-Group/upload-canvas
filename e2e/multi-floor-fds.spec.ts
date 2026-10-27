import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const SHOT_DIR = path.join(process.cwd(), 'e2e', '__screens__', 'multi-floor-fds')

test.use({ viewport: { width: 1440, height: 900 } })

test('Levels bar: add a floor, ground PDF, and reuse/upload on the new level', async ({ page }) => {
    await page.route('**/projects**', async (route) => {
        const method = route.request().method()
        if (method === 'GET') {
            await route.fulfill({ json: [] })
            return
        }
        if (method === 'POST') {
            await route.fulfill({
                json: {
                    id: 'proj-multi-floor',
                    name: 'Multi-floor PR check',
                    floors: [{ id: 'floor-0', floor_number: 0, name: 'Fire Floor' }],
                },
            })
            return
        }
        await route.fulfill({ json: {} })
    })

    mkdirSync(SHOT_DIR, { recursive: true })

    await page.goto('/')
    await expect(page.getByText('Signing in with Microsoft')).toHaveCount(0)

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Multi-floor PR check')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)

    await expect(page.getByTestId('floor-bar')).toHaveCount(0)
    const clusterAdd = page.getByTestId('add-floor-cluster-button')
    await expect(clusterAdd).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: 'All Projects' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/01-levels-bar-ground-floor.png`, fullPage: false })
    await page.screenshot({
        path: `${SHOT_DIR}/01b-plus-floor-cluster.png`,
        clip: { x: 900, y: 0, width: 540, height: 72 },
    })

    await clusterAdd.click()
    const floorBar = page.getByTestId('floor-bar')
    await expect(floorBar).toBeVisible({ timeout: 15000 })
    await expect(floorBar.getByText('Levels', { exact: false })).toBeVisible()
    await expect(page.getByTestId('add-floor-button')).toBeVisible()
    await expect(page.getByTestId('add-floor-cluster-button')).toHaveCount(0)
    await expect(page.getByTestId('floor-tab-1')).toBeVisible()
    await expect(page.getByTestId('drafting-sheet-banner')).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/02-levels-bar-after-add-floor.png`, fullPage: false })

    await page.getByTestId('banner-reuse-ground-pdf-button').click()
    await expect(page.getByTestId('drafting-sheet-banner')).toHaveCount(0)
    await page.screenshot({ path: `${SHOT_DIR}/03-level-1-with-pdf.png`, fullPage: false })

    await page.getByTestId('floor-tab-0').click()
    await expect(page.getByTestId('floor-tab-0')).toBeVisible()
    await page.getByTestId('floor-tab-1').click()
    await expect(page.getByTestId('floor-tab-1')).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/04-floor-switch-both-levels.png`, fullPage: false })
})
