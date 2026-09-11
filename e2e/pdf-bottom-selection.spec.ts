import { test, expect } from '@playwright/test'

test('uploaded PDF stays aligned and its bottom points can be selected', async ({ page }) => {
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
    const drawing = page.locator('canvas.z-10')
    await expect(drawing).toBeVisible()
    const background = page.locator('canvas').last()
    expect(await drawing.boundingBox()).toEqual(await background.boundingBox())
    const initialBox = (await drawing.boundingBox())!
    await page.mouse.move(initialBox.x + 200, initialBox.y + 200)
    await expect(page.getByRole('status')).toContainText('Select the first point')
    await page.mouse.click(initialBox.x + 200, initialBox.y + 200, { button: 'right' })
    await expect(page.getByRole('status')).toContainText('Select the first point')
    await page.mouse.click(initialBox.x + 200, initialBox.y + 200)
    await expect(page.getByRole('status')).toContainText('Select the second point')
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(initialBox.x + 200, initialBox.y + 140, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(30)
    await expect(page.getByRole('status')).toContainText('Select the second point')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('status')).toContainText('Select the first point')
    await page.evaluate(() => {
        const store = (window as any).__useStore
        store.setState({ tool: 'selection', pixelsPerMesh: 10, elements: [
            { id: 9001, type: 'point', comments: 'obstruction', points: [{ x: 450, y: 1490 }] },
        ] })
    })
    await expect(page.getByText('Set scale:', { exact: false })).toHaveCount(0)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const box = await drawing.boundingBox()
    if (!box) throw new Error('Missing drawing canvas')
    await page.mouse.move(box.x + 450, box.y + 1490)
    await page.mouse.down()
    await expect.poll(() => page.evaluate(() => (window as any).__useStore.getState().selectedElement?.element.id)).toBe(9001)
    await page.mouse.up()

    // Zoom at a visible point, then select the same stored PDF point again.
    const browserScale = await page.evaluate(() => window.devicePixelRatio)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await drawing.boundingBox())!.width).toBeGreaterThan(900)
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(browserScale)
    expect(await drawing.boundingBox()).toEqual(await background.boundingBox())
    let zoomed = (await drawing.boundingBox())!
    let zoom = zoomed.width / 900
    await page.mouse.move(zoomed.x + 450 * zoom, zoomed.y + 1490 * zoom)
    await page.mouse.down()
    await expect.poll(() => page.evaluate(() => (window as any).__useStore.getState().selectedElement?.element.id)).toBe(9001)
    await page.mouse.up()

    await page.keyboard.down('Control')
    await page.mouse.wheel(0, 350)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await drawing.boundingBox())!.width).toBeLessThan(900)
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(browserScale)
    zoomed = (await drawing.boundingBox())!
    zoom = zoomed.width / 900
    await page.mouse.move(zoomed.x + 450 * zoom, zoomed.y + 1490 * zoom)
    await page.mouse.down()
    await expect.poll(() => page.evaluate(() => (window as any).__useStore.getState().selectedElement?.element.id)).toBe(9001)
    await page.mouse.up()

    // Placing a new point after zoom stores PDF coordinates, not screen pixels.
    await page.evaluate(() => (window as any).__useStore.setState({ tool: 'point' }))
    await page.mouse.click(zoomed.x + 600 * zoom, zoomed.y + 1400 * zoom)
    await expect.poll(() => page.evaluate(() => (window as any).__useStore.getState().elements.at(-1).points[0])).toEqual({ x: 600, y: 1400 })

    for (const comment of ['obstruction', 'efsWall', 'efsBoundary']) {
        await page.evaluate(comment => (window as any).__useStore.setState({ tool: 'polyline', comment }), comment)
        const clickPoint = async (x: number, y: number) => {
            const bounds = (await drawing.boundingBox())!
            await page.mouse.click(bounds.x + x * zoom, bounds.y + y * zoom)
        }
        await clickPoint(200, 1200)
        // Pan during the unfinished wall without inserting a middle-click vertex.
        const scrollBeforePan = await page.evaluate(() => window.scrollY)
        await page.mouse.down({ button: 'middle' })
        const panBox = (await drawing.boundingBox())!
        await page.mouse.move(panBox.x + 200 * zoom, panBox.y + 1200 * zoom + 40, { steps: 5 })
        await page.mouse.up({ button: 'middle' })
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollBeforePan - 30)
        await clickPoint(400, 1212) // Near-horizontal must remain diagonal.
        await page.keyboard.down('Control')
        await clickPoint(600, 1250) // Ctrl constrains this segment.
        await page.keyboard.up('Control')
        await clickPoint(750, 1224) // Releasing Ctrl restores free drawing.
        await page.keyboard.press('Enter')
        const points = await page.evaluate(() => (window as any).__useStore.getState().elements.at(-1).points)
        expect(points).toHaveLength(4)
        for (const [i, expected] of [{ x: 200, y: 1200 }, { x: 400, y: 1212 }, { x: 600, y: 1212 }, { x: 750, y: 1224 }].entries()) {
            expect(points[i].x).toBeCloseTo(expected.x, 0)
            expect(points[i].y).toBeCloseTo(expected.y, 0)
        }
    }
})
