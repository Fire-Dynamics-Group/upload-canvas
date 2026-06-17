// Docked, non-modal inspector panel. Replaces the centered full-screen input
// modals so the canvas stays visible and usable while configuring inputs.
//
// Deliberately NOT a modal: no full-screen dimming backdrop that blocks the
// canvas. It's a `complementary` landmark fixed to one edge. Closes via the ✕,
// Escape, or a click outside the panel.
//
// Rendered through a portal to <body> so it escapes the toolbar's stacking
// context (the toolbar sits in a z-30 fixed container). Without the portal the
// panel is trapped below the z-50 top-right project buttons no matter how high
// its own z-index is — they'd cover the ✕.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function SidePanel({ title, side = 'right', onClose, contentRef, children }) {
    const sideClass = side === 'left' ? 'left-0' : 'right-0'
    const panelRef = useRef(null)

    useEffect(() => {
        if (!onClose) return
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        const onDown = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
        }
        // Listen on pointerdown (capture): the canvas preventDefaults pointerdown,
        // which suppresses the compatibility mousedown — so a mousedown listener
        // would never fire for clicks on the plan. Capture phase runs before the
        // canvas's own handler regardless.
        document.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onDown, true)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('pointerdown', onDown, true)
        }
    }, [onClose])

    const panel = (
        <aside
            ref={panelRef}
            role="complementary"
            aria-label={title}
            data-side={side}
            style={{ zIndex: 70 }}
            className={`fixed top-0 bottom-0 ${sideClass} w-96 max-w-[90vw] bg-white text-black shadow-2xl flex flex-col`}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium">{title}</h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        title="Close (Esc)"
                        className="flex items-center justify-center w-8 h-8 rounded-md text-gray-600 hover:text-black hover:bg-gray-200 text-2xl leading-none"
                    >
                        ✕
                    </button>
                )}
            </div>
            <div ref={contentRef} className="flex-1 overflow-y-auto p-4">{children}</div>
        </aside>
    )

    if (typeof document === 'undefined') return null
    return createPortal(panel, document.body)
}
