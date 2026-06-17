import { useState } from 'react'
import { saveAs } from 'file-saver'
import useStore from '../store/useStore'
import { fdsElementSignature } from '../utils/fdsSignature'
import { generateFdsCode } from '../utils/generateFds'

// Full-screen overlay showing the raw FDS text the backend returned — the
// honest "what will actually be simulated" view. Generates on demand (no need
// to hit the toolbar's download button first) and flags itself stale once the
// drawing changes.
export default function FdsCodeView() {
    const fdsCode = useStore((s) => s.fdsCode)
    const fdsGenSig = useStore((s) => s.fdsGenSig)
    const elements = useStore((s) => s.elements)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const stale = Boolean(fdsCode) && fdsElementSignature(elements) !== fdsGenSig

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

    const download = () => {
        if (fdsCode) saveAs(new Blob([fdsCode], { type: 'text/plain;charset=utf-8' }), 'model.fds')
    }

    return (
        <div className="fixed inset-0 z-[90] bg-gray-900 flex flex-col">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800 text-white">
                <span className="text-sm font-medium">FDS Code</span>
                {stale && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        out of date — regenerate
                    </span>
                )}
                <div className="ml-auto flex gap-2">
                    <button
                        type="button"
                        onClick={regenerate}
                        disabled={busy}
                        className="text-sm px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-800 disabled:bg-gray-600"
                    >
                        {busy ? 'Generating…' : fdsCode ? 'Regenerate' : 'Generate FDS'}
                    </button>
                    <button
                        type="button"
                        onClick={download}
                        disabled={!fdsCode}
                        className="text-sm px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
                    >
                        Download .fds
                    </button>
                </div>
            </div>

            {error && <div className="px-4 py-2 text-sm text-red-300 bg-red-900/30">{error}</div>}

            {fdsCode ? (
                <pre className="flex-1 overflow-auto m-0 p-4 text-[12px] leading-5 text-gray-200 font-mono whitespace-pre">
                    {fdsCode}
                </pre>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <p className="text-sm">No FDS generated yet.</p>
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
    )
}
