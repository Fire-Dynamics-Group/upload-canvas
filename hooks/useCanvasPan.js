import { useEffect } from 'react'

export default function useCanvasPan(stageRef, enabled) {
    useEffect(() => {
        const stage = stageRef.current
        if (!stage || !enabled) return
        let drag = null
        let spaceHeld = false
        const stop = () => {
            if (!drag) return
            if (stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id)
            drag = null
            stage.style.cursor = ''
        }
        const down = (event) => {
            const primaryDrag = event.button === 0 && spaceHeld
            const middleDrag = event.button === 1
            if ((!primaryDrag && !middleDrag) || event.target.tagName !== 'CANVAS') return
            event.preventDefault()
            event.stopPropagation()
            drag = { button: event.button, id: event.pointerId, x: event.clientX, y: event.clientY, left: window.scrollX, top: window.scrollY }
            stage.setPointerCapture(event.pointerId)
            stage.style.cursor = 'grabbing'
        }
        const move = (event) => {
            if (!drag || event.pointerId !== drag.id) return
            const stillDragging = drag.button === 1 ? (event.buttons & 4) : (event.buttons & 1)
            if (!stillDragging) { stop(); return }
            event.preventDefault()
            window.scrollTo({ left: drag.left + drag.x - event.clientX, top: drag.top + drag.y - event.clientY, behavior: 'instant' })
        }
        const up = (event) => {
            if (!drag || event.pointerId !== drag.id) return
            event.preventDefault()
            event.stopPropagation()
            stop()
        }
        const preventAutoscroll = (event) => {
            if (event.button === 1 || (event.button === 0 && spaceHeld)) event.preventDefault()
        }
        const keyDown = (event) => {
            if (event.code !== 'Space' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
            spaceHeld = true
            if (!drag) event.preventDefault()
        }
        const keyUp = (event) => {
            if (event.code === 'Space') spaceHeld = false
        }
        const clearSpace = () => { spaceHeld = false }
        stage.addEventListener('pointerdown', down, true)
        stage.addEventListener('mousedown', preventAutoscroll)
        stage.addEventListener('auxclick', preventAutoscroll)
        window.addEventListener('keydown', keyDown)
        window.addEventListener('keyup', keyUp)
        window.addEventListener('pointermove', move, { passive: false })
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', up, true)
        window.addEventListener('blur', stop)
        window.addEventListener('blur', clearSpace)
        stage.addEventListener('lostpointercapture', stop)
        return () => {
            stop()
            stage.removeEventListener('pointerdown', down, true)
            stage.removeEventListener('mousedown', preventAutoscroll)
            stage.removeEventListener('auxclick', preventAutoscroll)
            window.removeEventListener('keydown', keyDown)
            window.removeEventListener('keyup', keyUp)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up, true)
            window.removeEventListener('pointercancel', up, true)
            window.removeEventListener('blur', stop)
            window.removeEventListener('blur', clearSpace)
            stage.removeEventListener('lostpointercapture', stop)
        }
    }, [stageRef, enabled])
}
