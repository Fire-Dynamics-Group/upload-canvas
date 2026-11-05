const { chromium } = require('playwright')
const path = require('path')

const ARTIFACT_DIR = 'C:/Users/IanShaw/.gemini/antigravity-cli/brain/ef1cd99b-a255-4c2f-89b5-e59253666e35'

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const dialogs = []
  page.on('dialog', async (dialog) => {
    console.log(`[DIALOG TRIGGERED]: ${dialog.type()} message: "${dialog.message()}"`)
    dialogs.push({ type: dialog.type(), message: dialog.message() })
    await dialog.accept()
  })

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
      console.log(`[BROWSER ERROR]: ${msg.text()}`)
    }
  })

  console.log('--- TEST 1: Direct Deep Link to Canvas ---')
  await page.goto('http://localhost:3000/?project=556c4afa-6415-494f-a46d-69e6cae619fc&returnTo=structural-fire', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Verify no error alert
  if (dialogs.length > 0) {
    console.error('FAIL: Alert dialog was popped up!', dialogs)
  } else {
    console.log('PASS: No alert dialogs appeared on deep link!')
  }

  // Check canvas dimensions and visibility
  const canvasInfo = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    return canvases.map(c => ({
      className: c.className,
      width: c.width,
      height: c.height,
      offsetWidth: c.offsetWidth,
      offsetHeight: c.offsetHeight,
      visible: c.offsetParent !== null
    }))
  })
  console.log('Canvases found on page:', canvasInfo)

  // Check if robot overlay is gone and canvas is loaded
  const robotVisible = await page.evaluate(() => {
    const robot = document.querySelector('.fixed.inset-0')
    return Boolean(robot && robot.textContent.includes('Loading project'))
  })
  console.log('Robot "Loading project" overlay visible?:', robotVisible)

  // Check SFE Studio link
  const sfeButton = await page.$('a:has-text("SFE Studio")')
  console.log('SFE Studio link exists?:', Boolean(sfeButton))

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_canvas_deep_link_success.png'), fullPage: false })
  console.log('Screenshot saved: 05_canvas_deep_link_success.png')

  console.log('--- TEST 2: Navigate to /structural-fire and click "Open on Canvas" ---')
  await page.goto('http://localhost:3000/structural-fire', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Click purple "Open on Canvas" link
  const openCanvasBtn = await page.waitForSelector('a:has-text("Open on Canvas"), button:has-text("Open on Canvas")', { timeout: 10000 })
  console.log('Found "Open on Canvas" button, clicking...')
  await openCanvasBtn.click()

  // Wait for canvas page to load
  await page.waitForURL(/localhost:3000\/\?project=/, { timeout: 10000 })
  await page.waitForTimeout(3000)

  if (dialogs.length > 0) {
    console.error('FAIL: Alert dialog triggered during "Open on Canvas":', dialogs)
  } else {
    console.log('PASS: No alert dialog triggered from "Open on Canvas"!')
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_canvas_from_open_button.png'), fullPage: false })
  console.log('Screenshot saved: 06_canvas_from_open_button.png')

  console.log('--- TEST 3: Return to Structural Fire and click "Edit Geometry on Canvas" ---')
  // Click "SFE Studio"
  const sfeLink = await page.waitForSelector('a:has-text("SFE Studio")', { timeout: 5000 })
  await sfeLink.click()
  await page.waitForURL(/localhost:3000\/structural-fire/, { timeout: 10000 })
  await page.waitForTimeout(2000)

  // Switch to Time Equivalence tab
  const timeEqTab = await page.waitForSelector('button:has-text("Time Equivalence & Reliability")', { timeout: 5000 })
  await timeEqTab.click()
  await page.waitForTimeout(1000)

  // Click "Edit Geometry on Canvas"
  const editGeomBtn = await page.waitForSelector('button:has-text("Edit Geometry on Canvas")', { timeout: 5000 })
  console.log('Found "Edit Geometry on Canvas", clicking...')
  await editGeomBtn.click()

  await page.waitForURL(/localhost:3000\/\?project=/, { timeout: 10000 })
  await page.waitForTimeout(3000)

  if (dialogs.length > 0) {
    console.error('FAIL: Alert dialog triggered during "Edit Geometry on Canvas":', dialogs)
  } else {
    console.log('PASS: No alert dialog triggered from "Edit Geometry on Canvas"!')
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_canvas_from_edit_geometry.png'), fullPage: false })
  console.log('Screenshot saved: 07_canvas_from_edit_geometry.png')

  console.log('\n--- VERIFICATION SUMMARY ---')
  console.log('Dialogs triggered:', dialogs.length)
  console.log('Browser errors:', consoleErrors.filter(e => !e.includes('favicon')).length)

  await browser.close()
}

run().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
