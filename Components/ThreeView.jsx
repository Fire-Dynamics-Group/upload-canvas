import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import useStore from '../store/useStore'
import { fdsElementSignature } from '../utils/fdsSignature'
import { generateFdsCode } from '../utils/generateFds'

// three.js touches `window`/WebGL, so the renderer is loaded client-side only.
// Keeping the ~heavy 3D bundle behind a dynamic import also means 2D-only users
// never download it.
const Scene3D = dynamic(() => import('./Scene3D'), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Loading 3D…
        </div>
    ),
})

// Full-screen overlay hosting the 3D model. The model is built from the FDS
// text (ground truth), so it doubles as verification of the generated input.
export default function ThreeView() {
    const fdsCode = useStore((s) => s.fdsCode)
    const fdsGenSig = useStore((s) => s.fdsGenSig)
    const elements = useStore((s) => s.elements)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const stale = Boolean(fdsCode) && fdsElementSignature(elements) !== fdsGenSig

    // Auto-refresh on tab-open when the FDS is stale (Q4): switching to 3D should
    // show current geometry without regenerating during 2D drawing. Empty (never
    // generated) is left to the explicit button so we don't surprise-call the
    // backend. Guarded so React StrictMode's double-mount fires it once.
    const didAuto = useRef(false)
    useEffect(() => {
        if (didAuto.current) return
        didAuto.current = true
        if (useStore.getState().isFdsStale()) regenerate()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const regenerate = async () => {
        setBusy(true)
        setError(null)
        try {
            await generateFdsCode({ download: false })
        } catch (e) {
            setError(e?.message || 'Failed to generate FDS')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[90] bg-[#2b2f3a] flex flex-col">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800 text-white">
                <span className="text-sm font-medium">3D View</span>
                <span className="text-[11px] text-gray-400">built from FDS — verifies the generated input</span>
                {stale && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        out of date — regenerate
                    </span>
                )}
                <div className="ml-auto">
                    <button
                        type="button"
                        onClick={regenerate}
                        disabled={busy}
                        className="text-sm px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-800 disabled:bg-gray-600"
                    >
                        {busy ? 'Generating…' : fdsCode ? 'Regenerate' : 'Generate FDS'}
                    </button>
                </div>
            </div>

            {error && <div className="px-4 py-2 text-sm text-red-300 bg-red-900/30">{error}</div>}

            <div className="relative flex-1">
                {fdsCode ? (
                    <Scene3D fdsCode={fdsCode} />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-300">
                        <p className="text-sm">No FDS generated yet — the 3D model is built from it.</p>
                        <button
                            type="button"
                            onClick={regenerate}
                            disabled={busy}
                            className="text-sm px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:bg-gray-600 text-white"
                        >
                            {busy ? 'Generating…' : 'Generate FDS from drawing'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
