import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { combineMultiFloorFds } from '../utils/multiFloorFds'

const FIXTURE = path.join(
    process.cwd(),
    'e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf',
)
const RAILWAY_DEV = 'https://backendfornextapp-dev.up.railway.app'
const OUT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/multi-floor-mesh-align'

function parseMeshTable(fdsText: string) {
    return fdsText
        .split(/\r?\n/)
        .filter((l) => l.trim().toUpperCase().startsWith('&MESH'))
        .map((line) => {
            const id = line.match(/ID='([^']+)'/i)?.[1] || ''
            const ijk = line.match(/IJK=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/i)
            const xb = (line.match(/XB=\s*([^/]+)/i)?.[1] || '').split(',').map(Number)
            const i = ijk ? Number(ijk[1]) : 0
            const j = ijk ? Number(ijk[2]) : 0
            const k = ijk ? Number(ijk[3]) : 0
            return {
                id,
                i,
                j,
                k,
                ijk: ijk ? `${ijk[1]},${ijk[2]},${ijk[3]}` : '',
                xb: xb.join(','),
                xmin: xb[0],
                xmax: xb[1],
                ymin: xb[2],
                ymax: xb[3],
                zmin: xb[4],
                zmax: xb[5],
            }
        })
}

test.use({ viewport: { width: 1440, height: 900 } })

test('stacked meshes: larger ground, smaller upper, overlap on the cell grid', async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true })

    const fdsFloor0 = [
        "&HEAD CHID='tower'/",
        "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,10.0,0.0,10.0,0.0,3.0/",
        "&OBST ID='Wall', XB=0.0,10.0,0.0,0.2,0.0,3.0, SURF_ID='INERT'/",
        "&TAIL /",
    ].join('\n')
    const fdsFloor1 = [
        "&HEAD CHID='tower'/",
        "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,8.0,0.0,8.0,3.0,6.0/",
        "&OBST ID='Wall', XB=0.0,8.0,0.0,0.2,3.0,6.0, SURF_ID='INERT'/",
        "&TAIL /",
    ].join('\n')
    const runs = [
        { floorNumber: 0, fdsText: fdsFloor0, dx: 0, dy: 0, slabLines: [] },
        { floorNumber: 1, fdsText: fdsFloor1, dx: 1.0, dy: 1.0, slabLines: [] },
    ]
    const misaligned = combineMultiFloorFds(runs, { alignStackedMeshes: false })
    const aligned = combineMultiFloorFds(runs)
    writeFileSync(path.join(OUT_DIR, 'misaligned-before.fds'), misaligned)
    writeFileSync(path.join(OUT_DIR, 'aligned-after.fds'), aligned)

    const beforeMeshes = parseMeshTable(misaligned)
    const afterMeshes = parseMeshTable(aligned)
    const g0 = afterMeshes.find((m) => m.id.startsWith('F0_'))!
    const g1 = afterMeshes.find((m) => m.id.startsWith('F1_'))!
    const cell0 = (g0.xmax - g0.xmin) / g0.i
    const cell1 = (g1.xmax - g1.xmin) / g1.i
    expect(beforeMeshes[0].xmin).not.toBe(beforeMeshes[1].xmin)
    expect(g0.xmax - g0.xmin).toBeGreaterThan(g1.xmax - g1.xmin)
    expect(g0.xmin).not.toBe(g1.xmin)
    expect(g0.xmax).not.toBe(g1.xmax)
    expect(cell1).toBeCloseTo(cell0, 5)
    expect((g1.xmin - g0.xmin) / cell0).toBeCloseTo(Math.round((g1.xmin - g0.xmin) / cell0), 5)
    expect((g1.xmax - g0.xmin) / cell0).toBeCloseTo(Math.round((g1.xmax - g0.xmin) / cell0), 5)

    const tablePage = await page.context().newPage()
    const rows = [
        ...beforeMeshes.map((m) => ({ ...m, state: 'before (0.8 m vs 1 m cells)' })),
        ...afterMeshes.map((m) => ({ ...m, state: 'after (same cell size; upper stays smaller)' })),
    ]
    await tablePage.setContent(`<!doctype html><html><body style="font-family:ui-sans-serif,system-ui,sans-serif;padding:28px;background:#111827;color:#e5e7eb">
      <h1 style="font-size:20px;margin:0 0 8px">Stacked MESH XB / IJK — floor-by-floor</h1>
      <p style="margin:0 0 16px;color:#9ca3af;font-size:14px">Meshes stay per floor. Ground can be bigger. Overlap bounds land on a shared cell grid so FDS/PyroSim faces meet. No mesh spans two floors.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr>${['state', 'id', 'IJK', 'XB (xmin,xmax,ymin,ymax,zmin,zmax)'].map((h) => `<th style="text-align:left;padding:8px 12px;border-bottom:1px solid #374151">${h}</th>`).join('')}</tr>
        ${rows.map((r) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937">${r.state}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;font-family:monospace">${r.id}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;font-family:monospace">${r.ijk}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1f2937;font-family:monospace">${r.xb}</td>
        </tr>`).join('')}
      </table>
    </body></html>`)
    await tablePage.screenshot({ path: path.join(OUT_DIR, '00-mesh-table.png'), fullPage: true })
    await tablePage.close()
    writeFileSync(
        path.join(OUT_DIR, 'mesh-xb-ijk.txt'),
        ['id\tIJK\tXB', ...afterMeshes.map((m) => `${m.id}\t${m.ijk}\t${m.xb}`)].join('\n') + '\n',
    )

    await page.route('**/projects**', async (route) => {
        const method = route.request().method()
        if (method === 'GET') {
            await route.fulfill({ json: [] })
            return
        }
        if (method === 'POST') {
            await route.fulfill({
                json: {
                    id: 'proj-mesh-align',
                    name: 'Mesh align',
                    floors: [{ id: 'floor-0', floor_number: 0, name: 'Fire Floor' }],
                },
            })
            return
        }
        await route.fulfill({ json: {} })
    })

    await page.route('**/fds', async (route) => {
        const cors = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization',
        }
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: cors })
            return
        }
        const resp = await fetch(`${RAILWAY_DEV}/fds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: route.request().postData() || '{}',
        })
        const body = await resp.text()
        await route.fulfill({
            status: resp.status,
            headers: { ...cors, 'content-type': resp.headers.get('content-type') || 'application/json' },
            body,
        })
    })

    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}))
    await page.goto('/')
    await page.addStyleTag({ content: 'nextjs-portal{display:none !important;}' }).catch(() => {})

    const newProject = page.getByRole('button', { name: '+ New Project' })
    await expect(newProject).toBeVisible({ timeout: 30000 })
    await newProject.click()
    await page.getByPlaceholder('Project name').fill('Mesh align')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const fileInput = page.locator('input#image[type=file], input[type=file][accept=".pdf"]').first()
    await expect(fileInput).toBeAttached({ timeout: 15000 })
    await fileInput.setInputFiles(FIXTURE)
    await expect(page.getByTestId('add-floor-cluster-button')).toBeVisible({ timeout: 30000 })

    const enterBtn = page.getByRole('button', { name: 'Enter', exact: true })
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enterBtn.click()
    }

    await page.waitForFunction(() => Boolean((window as any).__useStore), null, { timeout: 30000 })
    await page.evaluate((text) => {
        const store = (window as any).__useStore
        store.setState({ tool: 'selection' })
        store.getState().captureFds(text)
        store.getState().setViewMode('3d')
    }, misaligned)
    const frameBtn = page.getByRole('button', { name: 'Frame', exact: true })
    await expect(frameBtn).toBeVisible({ timeout: 30000 })
    await frameBtn.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(OUT_DIR, '01-misaligned-3d.png'), fullPage: false })

    await page.evaluate((text) => {
        const store = (window as any).__useStore
        store.getState().captureFds(text)
        store.getState().setViewMode('3d')
    }, aligned)
    await expect(frameBtn).toBeVisible({ timeout: 15000 })
    await frameBtn.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(OUT_DIR, '02-aligned-3d.png'), fullPage: false })

    await page.getByRole('button', { name: 'FDS Code', exact: true }).click()
    await expect(page.getByText("&MESH ID='F0_", { exact: false })).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: path.join(OUT_DIR, '03-aligned-fds-code.png'), fullPage: false })

    await page.getByRole('button', { name: '2D View', exact: true }).click()
    await page.getByTestId('add-floor-cluster-button').click()
    await expect(page.getByTestId('floor-bar')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('banner-reuse-ground-pdf-button').click()
    await page.evaluate(() => {
        ;(window as any).__useStore.setState({ fdsCode: '', fdsGenSig: null })
    })

    await page.evaluate(() => {
        const store = (window as any).__useStore
        const shared = {
            tool: 'selection',
            pixelsPerMesh: 1,
            originPixels: { x: 0, y: 0 },
            isSprinklered: false,
            includeSensors: false,
            simEndTime: 30,
            doorLeakagesEnabled: false,
            wallHeight: 3,
            totalFloors: 2,
        }
        store.getState().setActiveFloor(0)
        store.setState({ ...shared, fireFloorZ: 0 })
        store.getState().addElement({
            id: 1,
            type: 'rect',
            comments: 'mesh',
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
            ],
        })
        store.getState().addElement({
            id: 2,
            type: 'polyline',
            comments: 'obstruction',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        })
        store.getState().setActiveFloor(1)
        store.setState({ ...shared, fireFloorZ: 3 })
        store.getState().addElement({
            id: 1,
            type: 'rect',
            comments: 'mesh',
            points: [
                { x: 20, y: 20 },
                { x: 80, y: 20 },
                { x: 80, y: 80 },
                { x: 20, y: 80 },
            ],
        })
        store.getState().addElement({
            id: 2,
            type: 'polyline',
            comments: 'obstruction',
            points: [{ x: 20, y: 20 }, { x: 80, y: 20 }],
        })
    })

    await page.getByRole('button', { name: 'Generate FDS code' }).click()
    await expect.poll(async () => {
        return page.evaluate(() => ((window as any).__useStore.getState().fdsCode || '').length)
    }, { timeout: 60000 }).toBeGreaterThan(1000)

    const live = await page.evaluate(() => (window as any).__useStore.getState().fdsCode as string)
    writeFileSync(path.join(OUT_DIR, 'aligned-live.fds'), live)
    expect(live).toMatch(/CHID='model'/)
    const liveMeshes = parseMeshTable(live)
    expect(liveMeshes.length).toBeGreaterThanOrEqual(2)
    const live0 = liveMeshes.find((m) => m.id.startsWith('F0_'))!
    const live1 = liveMeshes.find((m) => m.id.startsWith('F1_'))!
    const liveCell0 = (live0.xmax - live0.xmin) / live0.i
    const liveCell1 = (live1.xmax - live1.xmin) / live1.i
    expect(live0.xmax - live0.xmin).toBeGreaterThan(live1.xmax - live1.xmin)
    expect(live0.xmin).not.toBe(live1.xmin)
    expect(live0.xmax).not.toBe(live1.xmax)
    expect(live0.i).not.toBe(live1.i)
    expect(liveCell1).toBeCloseTo(liveCell0, 5)
    expect((live1.xmin - live0.xmin) / liveCell0).toBeCloseTo(
        Math.round((live1.xmin - live0.xmin) / liveCell0),
        5,
    )
    writeFileSync(
        path.join(OUT_DIR, 'mesh-xb-ijk.txt'),
        [
            'id\tIJK\tXB',
            ...afterMeshes.map((m) => `${m.id}\t${m.ijk}\t${m.xb}\tcombiner`),
            ...liveMeshes.map((m) => `${m.id}\t${m.ijk}\t${m.xb}\tlive-/fds`),
        ].join('\n') + '\n',
    )

    await page.getByRole('button', { name: '3D View', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Frame', exact: true })).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Frame', exact: true }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(OUT_DIR, '04-aligned-live-3d.png'), fullPage: false })
})
