import { test, expect } from '@playwright/test'
test.use({ channel: process.env.EFS_TEST_BROWSER })

test('scale stops at its second point while the distance dialog is open', async ({ page }) => {
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
    const canvas = page.locator('canvas.z-10')
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + 100, box.y + 100)
    await page.mouse.click(box.x + 300, box.y + 100)
    await expect(page.getByText('Enter Length of Line (m)', { exact: true })).toBeVisible()
    const snapshot = () => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())
    const completed = await snapshot()
    await page.mouse.move(box.x + 400, box.y + 250)
    await page.mouse.move(box.x + 500, box.y + 350)
    expect(await snapshot()).toBe(completed)
    await page.getByPlaceholder('Enter scale line length (m)').fill('10')
    expect(await snapshot()).toBe(completed)
    await page.getByRole('button', { name: 'Enter', exact: true }).click()
    await expect(page.getByText('Enter Length of Line (m)', { exact: true })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as any).__useStore.getState().pixelsPerMesh)).toBe(2)
})
