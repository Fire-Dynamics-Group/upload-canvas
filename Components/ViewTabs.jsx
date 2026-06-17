import useStore from '../store/useStore'
import { fdsElementSignature } from '../utils/fdsSignature'

// PyroSim-style view switcher: 2D drawing / 3D model / FDS code. The 3D and FDS
// tabs are always available — they render whatever FDS was last generated (and
// flag themselves stale once the drawing changes). Anchored bottom-left like
// PyroSim so it never collides with the bottom-centre drawing toolbar.
const TABS = [
    { id: '2d', label: '2D View' },
    { id: '3d', label: '3D View' },
    { id: 'fds', label: 'FDS Code' },
]

export default function ViewTabs() {
    const viewMode = useStore((s) => s.viewMode)
    const setViewMode = useStore((s) => s.setViewMode)
    const fdsCode = useStore((s) => s.fdsCode)
    const fdsGenSig = useStore((s) => s.fdsGenSig)
    const elements = useStore((s) => s.elements)
    const stale = Boolean(fdsCode) && fdsElementSignature(elements) !== fdsGenSig

    return (
        <div className="fixed bottom-2 left-2 z-[110] flex rounded-lg overflow-hidden shadow-lg border border-gray-700">
            {TABS.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => setViewMode(t.id)}
                    className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                        viewMode === t.id
                            ? 'bg-blue-700 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                >
                    {t.label}
                    {/* Stale dot on the derived tabs when the drawing has moved on. */}
                    {t.id !== '2d' && stale && (
                        <span
                            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"
                            title="FDS is out of date — regenerate"
                        />
                    )}
                </button>
            ))}
        </div>
    )
}
