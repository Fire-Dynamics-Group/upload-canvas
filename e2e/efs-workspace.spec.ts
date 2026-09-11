import { test, expect } from '@playwright/test'
test.use({ channel: process.env.EFS_TEST_BROWSER })

test('EFS side panels keep drawing and calculation accessible', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('upload-canvas-username', 'Canvas test'))
    await page.route('**/projects**', route => route.fulfill({ json: [] }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Radiation', exact: true }).click()
    // A tall, blank single-page PDF; no remote storage or project writes needed.
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 1000] /Resources << >> /Contents 4 0 R >>',
        '<< /Length 0 >>\nstream\nendstream',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, i) => {
        offsets.push(Buffer.byteLength(pdf))
        pdf += `${i + 1} 0 obj\n${object}\nendobj\n`
    })
    const xref = Buffer.byteLength(pdf)
    pdf += 'xref\n0 5\n0000000000 65535 f \n'
    pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
    pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    await page.locator('input[type=file]').setInputFiles({ name: 'tall.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) })
    await page.evaluate(() => {
        const store = (window as any).__useStore
        store.getState().setCurrentMode('efs')
        store.setState({ tool: 'selection', pixelsPerMesh: 1, efsColumnSpacing: 8, efsCalcDone: false, efsProtectedByElev: {}, elements: [
            { id: 1, type: 'polyline', comments: 'efsWall', points: [{x: 50, y: 250}, {x: 290, y: 250}] },
            { id: 2, type: 'polyline', comments: 'efsBoundary', points: [{x: 20, y: 80}, {x: 330, y: 80}] },
        ] })
    })
    const left = page.getByRole('complementary', { name: 'Drawing tools' })
    const right = page.getByRole('complementary', { name: 'Calculation parameters and results' })
    await expect(left).toBeVisible()
    await expect(right).toBeVisible()
    await left.getByRole('button', { name: 'Build wall', exact: false }).click()
    await expect(left.getByRole('button', { name: 'Build wall', exact: false })).toHaveAttribute('aria-pressed', 'true')
    await right.getByRole('button', { name: 'Run Calc', exact: true }).click()
    await expect(right.getByRole('columnheader', { name: 'Column', exact: true })).toBeVisible()
    await left.getByRole('button', { name: 'Set protection', exact: false }).click()
    const drawing = page.locator('canvas.z-10')
    const box = (await drawing.boundingBox())!
    await page.mouse.click(box.x + 250, box.y + 250)
    await expect(right.getByLabel('Protect bay 3', { exact: true })).toBeChecked()
    await right.getByRole('button', { name: 'Expand', exact: true }).click()
    await expect(right.getByRole('button', { name: 'Compact', exact: true })).toBeVisible()
    await right.getByRole('button', { name: 'Compact', exact: true }).click()
    await page.screenshot({ path: 'e2e/efs-workspace-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(left).toBeVisible()
    await expect(right).toBeVisible()
    const l = (await left.boundingBox())!, r = (await right.boundingBox())!
    expect(l.y + l.height).toBeLessThan(r.y)
    await page.screenshot({ path: 'e2e/efs-workspace-mobile.png' })
})
