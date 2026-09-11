import { useEffect } from 'react'

export default function useCanvasPan(stageRef, enabled) {
    useEffect(() => {
        const stage = stageRef.current
        if (!stage || !enabled) return
        let drag = null
        const stop = () => {
            if (!drag) return
            if (stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id)
            drag = null
            stage.style.cursor = ''
        }
        const down = (event) => {
            if (event.button !== 1 || event.target.tagName !== 'CANVAS') return
            event.preventDefault()
            event.stopPropagation()
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: window.scrollX, top: window.scrollY }
            stage.setPointerCapture(event.pointerId)
            stage.style.cursor = 'grabbing'
        }
        const move = (event) => {
            if (!drag || event.pointerId !== drag.id) return
            if (!(event.buttons & 4)) { stop(); return }
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
            if (event.button === 1) event.preventDefault()
        }
        stage.addEventListener('pointerdown', down, true)
        stage.addEventListener('mousedown', preventAutoscroll)
        stage.addEventListener('auxclick', preventAutoscroll)
        window.addEventListener('pointermove', move, { passive: false })
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', up, true)
        window.addEventListener('blur', stop)
        stage.addEventListener('lostpointercapture', stop)
        return () => {
            stop()
            stage.removeEventListener('pointerdown', down, true)
            stage.removeEventListener('mousedown', preventAutoscroll)
            stage.removeEventListener('auxclick', preventAutoscroll)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up, true)
            window.removeEventListener('pointercancel', up, true)
            window.removeEventListener('blur', stop)
            stage.removeEventListener('lostpointercapture', stop)
        }
    }, [stageRef, enabled])
}
