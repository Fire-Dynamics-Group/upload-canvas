// Docked, non-modal inspector panel. Replaces the centered full-screen input
// modals so the canvas stays visible and usable while configuring inputs.
//
// Deliberately NOT a modal: no full-screen dimming backdrop that blocks the
// canvas. It's a `complementary` landmark fixed to one edge.

export default function SidePanel({ title, side = 'right', onClose, contentRef, children }) {
    const sideClass = side === 'left' ? 'left-0' : 'right-0'
    return (
        <aside
            role="complementary"
            aria-label={title}
            data-side={side}
            className={`fixed top-0 bottom-0 ${sideClass} z-40 w-96 max-w-[90vw] bg-white text-black shadow-2xl flex flex-col`}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium">{title}</h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="text-gray-500 hover:text-black text-xl leading-none"
                    >
                        ✕
                    </button>
                )}
            </div>
            <div ref={contentRef} className="flex-1 overflow-y-auto p-4">{children}</div>
        </aside>
    )
}
