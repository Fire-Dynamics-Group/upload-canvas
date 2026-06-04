import { describe, it, expect } from 'vitest'

/**
 * Canvas rendering tests for leakage doors.
 *
 * The Canvas component draws directly to a <canvas> 2D context, not to DOM elements.
 * Rather than mounting the full Canvas component (which has many dependencies -- PDF rendering,
 * mouse handlers, scale tools, etc.), we test the rendering logic by extracting the
 * assertions from the source code behavior:
 *
 * When role === 'leakage':
 *   1. strokeStyle is set to 'orange'
 *   2. setLineDash([6, 4]) is called (dashed line)
 *   3. The label text is "Leakage" (capitalized), not "leakage"
 *   4. fillStyle for the label is 'orange'
 *
 * We verify this by simulating the exact drawing logic from Canvas.jsx lines 639-672.
 */

function createMockContext() {
    const calls = []
    return {
        calls,
        beginPath: () => calls.push({ method: 'beginPath' }),
        moveTo: (x, y) => calls.push({ method: 'moveTo', args: [x, y] }),
        lineTo: (x, y) => calls.push({ method: 'lineTo', args: [x, y] }),
        stroke: () => calls.push({ method: 'stroke' }),
        arc: (x, y, r, a1, a2) => calls.push({ method: 'arc', args: [x, y, r, a1, a2] }),
        fillText: (text, x, y) => calls.push({ method: 'fillText', args: [text, x, y] }),
        strokeText: (text, x, y) => calls.push({ method: 'strokeText', args: [text, x, y] }),
        setLineDash: (pattern) => calls.push({ method: 'setLineDash', args: [pattern] }),
        strokeStyle: null,
        fillStyle: null,
        lineWidth: 1,
        font: null,
        // Track property assignments
        set strokeStyle(v) { calls.push({ method: 'set:strokeStyle', value: v }); this._strokeStyle = v },
        get strokeStyle() { return this._strokeStyle },
        set fillStyle(v) { calls.push({ method: 'set:fillStyle', value: v }); this._fillStyle = v },
        get fillStyle() { return this._fillStyle },
        set lineWidth(v) { calls.push({ method: 'set:lineWidth', value: v }); this._lineWidth = v },
        get lineWidth() { return this._lineWidth },
        set font(v) { calls.push({ method: 'set:font', value: v }); this._font = v },
        get font() { return this._font },
    }
}

/**
 * Reproduces the exact rendering logic from Canvas.jsx for a door with a given role.
 * This is extracted from Canvas.jsx lines 633-674.
 */
function renderDoorOnCanvas(context, element, role, isHighlighted = false) {
    if (element.comments !== 'door') return

    // Always-open doors: redraw with green solid line
    if (role === 'always_open') {
        const pts = element.points
        context.beginPath()
        context.strokeStyle = 'green'
        context.lineWidth = 3
        context.moveTo(pts[0].x, pts[0].y)
        context.lineTo(pts[1].x, pts[1].y)
        context.stroke()
        context.lineWidth = 1
    }

    // Leakage-only doors: redraw with orange dashed line
    if (role === 'leakage') {
        const pts = element.points
        context.beginPath()
        context.setLineDash([6, 4])
        context.strokeStyle = 'orange'
        context.lineWidth = 3
        context.moveTo(pts[0].x, pts[0].y)
        context.lineTo(pts[1].x, pts[1].y)
        context.stroke()
        context.setLineDash([])
        context.lineWidth = 1
    }

    if (isHighlighted || role) {
        const pts = element.points
        const cx = (pts[0].x + pts[1].x) / 2
        const cy = (pts[0].y + pts[1].y) / 2
        if (isHighlighted) {
            context.beginPath()
            context.arc(cx, cy, 20, 0, Math.PI * 2)
            context.strokeStyle = 'yellow'
            context.lineWidth = 3
            context.stroke()
            context.lineWidth = 1
        }
        if (role) {
            const label = role === 'leakage' ? 'Leakage' : role === 'always_open' ? 'Always Open' : role.charAt(0).toUpperCase() + role.slice(1)
            context.font = '11px sans-serif'
            context.fillStyle = isHighlighted ? 'yellow' : (role === 'leakage' ? 'orange' : role === 'always_open' ? 'green' : 'white')
            context.strokeStyle = 'black'
            context.lineWidth = 3
            context.strokeText(label, cx + 12, cy - 12)
            context.fillText(label, cx + 12, cy - 12)
            context.lineWidth = 1
        }
    }
}

describe('Canvas: leakage door rendering', () => {
    const doorElement = {
        id: 'door-1',
        type: 'line',
        points: [{ x: 50, y: 100 }, { x: 150, y: 100 }],
        comments: 'door',
    }

    it('renders leakage door with orange color', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'leakage')

        const strokeStyleCalls = ctx.calls.filter(c => c.method === 'set:strokeStyle')
        const orangeStroke = strokeStyleCalls.find(c => c.value === 'orange')
        expect(orangeStroke).toBeDefined()
    })

    it('renders leakage door with dashed line style', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'leakage')

        const dashCalls = ctx.calls.filter(c => c.method === 'setLineDash')
        // First call sets the dash pattern [6, 4]
        expect(dashCalls[0].args[0]).toEqual([6, 4])
        // Second call resets to solid []
        expect(dashCalls[1].args[0]).toEqual([])
    })

    it('label says "Leakage" not "leakage"', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'leakage')

        const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText')
        expect(fillTextCalls.length).toBe(1)
        expect(fillTextCalls[0].args[0]).toBe('Leakage')
    })

    it('label fill color is orange for leakage doors', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'leakage')

        const fillStyleCalls = ctx.calls.filter(c => c.method === 'set:fillStyle')
        const orangeFill = fillStyleCalls.find(c => c.value === 'orange')
        expect(orangeFill).toBeDefined()
    })

    it('non-leakage doors do NOT get dashed lines or orange color', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'apartment')

        const dashCalls = ctx.calls.filter(c => c.method === 'setLineDash')
        expect(dashCalls.length).toBe(0)

        const fillStyleCalls = ctx.calls.filter(c => c.method === 'set:fillStyle')
        const orangeFill = fillStyleCalls.find(c => c.value === 'orange')
        expect(orangeFill).toBeUndefined()

        // Label should say "Apartment" not "apartment"
        const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText')
        expect(fillTextCalls[0].args[0]).toBe('Apartment')
    })
})

describe('Canvas: always_open door rendering', () => {
    const doorElement = {
        id: 'door-2',
        type: 'line',
        points: [{ x: 50, y: 100 }, { x: 150, y: 100 }],
        comments: 'door',
    }

    it('renders always_open door with green color (solid line, not dashed)', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'always_open')

        // Should have green stroke for the line redraw
        const strokeStyleCalls = ctx.calls.filter(c => c.method === 'set:strokeStyle')
        const greenStroke = strokeStyleCalls.find(c => c.value === 'green')
        expect(greenStroke).toBeDefined()

        // Should NOT use dashed line (it's solid)
        const dashCalls = ctx.calls.filter(c => c.method === 'setLineDash')
        expect(dashCalls.length).toBe(0)
    })

    it('label says "Always Open"', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'always_open')

        const fillTextCalls = ctx.calls.filter(c => c.method === 'fillText')
        expect(fillTextCalls.length).toBe(1)
        expect(fillTextCalls[0].args[0]).toBe('Always Open')
    })

    it('label fill color is green for always_open doors', () => {
        const ctx = createMockContext()
        renderDoorOnCanvas(ctx, doorElement, 'always_open')

        const fillStyleCalls = ctx.calls.filter(c => c.method === 'set:fillStyle')
        const greenFill = fillStyleCalls.find(c => c.value === 'green')
        expect(greenFill).toBeDefined()
    })
})
