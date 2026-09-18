// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useCanvasPan from '../hooks/useCanvasPan'

function setup() {
    const stage = document.createElement('div')
    const canvas = document.createElement('canvas')
    stage.appendChild(canvas)
    document.body.appendChild(stage)
    stage.setPointerCapture = vi.fn()
    stage.hasPointerCapture = vi.fn(() => true)
    stage.releasePointerCapture = vi.fn()
    const hook = renderHook(() => useCanvasPan({ current: stage }, true))
    return { stage, canvas, cleanup: () => { hook.unmount(); stage.remove() } }
}

function pointer(target, type, values) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, values)
    target.dispatchEvent(event)
    return event
}

describe('canvas panning', () => {
    it('leaves Space on buttons and primary-button drawing alone', () => {
        const { stage, canvas, cleanup } = setup()
        try {
            const button = document.createElement('button')
            stage.appendChild(button)
            const space = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })
            button.dispatchEvent(space)
            expect(space.defaultPrevented).toBe(false)
            const down = pointer(canvas, 'pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
            expect(down.defaultPrevented).toBe(false)
            expect(stage.setPointerCapture).not.toHaveBeenCalled()
        } finally { cleanup() }
    })

    it('pans with middle drag and releases capture on pointerup', () => {
        const { stage, canvas, cleanup } = setup()
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
        try {
            expect(pointer(canvas, 'pointerdown', { button: 1, pointerId: 2, clientX: 100, clientY: 100 }).defaultPrevented).toBe(true)
            expect(stage.setPointerCapture).toHaveBeenCalledWith(2)
            pointer(window, 'pointermove', { buttons: 4, pointerId: 2, clientX: 80, clientY: 70 })
            expect(scroll).toHaveBeenCalledWith({ left: window.scrollX + 20, top: window.scrollY + 30, behavior: 'instant' })
            pointer(window, 'pointerup', { pointerId: 2 })
            expect(stage.releasePointerCapture).toHaveBeenCalledWith(2)
            expect(stage.style.cursor).toBe('')
        } finally { cleanup(); scroll.mockRestore() }
    })
})
