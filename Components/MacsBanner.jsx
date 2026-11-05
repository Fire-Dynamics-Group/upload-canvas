import { useState } from 'react'
import useStore from '../store/useStore'
import { hasNewerMacsRun, applyMacsRunToInputs } from '../utils/macsHandoff'

export default function MacsBanner() {
    const macsRuns = useStore((state) => state.macsRuns)
    const macsNotice = useStore((state) => state.macsNotice)
    const setMacsNotice = useStore((state) => state.setMacsNotice)
    const timeEqInputs = useStore((state) => state.timeEqInputs)
    const setTimeEqInputs = useStore((state) => state.setTimeEqInputs)

    const [dismissedRunId, setDismissedRunId] = useState(null)

    const newerRun = hasNewerMacsRun(macsRuns, timeEqInputs)
    const showNewerRunBanner = newerRun && (newerRun.run_id || newerRun.id) !== dismissedRunId

    if (!macsNotice && !showNewerRunBanner) return null

    const formattedTime = newerRun?.client_timestamp
        ? new Date(newerRun.client_timestamp).toLocaleString()
        : (newerRun?.received_at ? new Date(newerRun.received_at).toLocaleString() : '')

    return (
        <div className="w-full flex flex-col gap-2 p-3 bg-blue-50 border-b border-blue-200 z-40 text-sm">
            {macsNotice && (
                <div className={`flex items-center justify-between p-2 rounded ${
                    macsNotice.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
                    macsNotice.type === 'info' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                    'bg-green-100 text-green-800 border border-green-200'
                }`}>
                    <span>{macsNotice.message}</span>
                    <button
                        type="button"
                        onClick={() => setMacsNotice(null)}
                        className="ml-4 font-bold text-gray-600 hover:text-black"
                    >
                        ×
                    </button>
                </div>
            )}

            {showNewerRunBanner && (
                <div className="flex items-center justify-between bg-blue-100 border border-blue-300 text-blue-900 px-4 py-2 rounded">
                    <div>
                        <span className="font-semibold">New MACs results</span>
                        {formattedTime && <span> from {formattedTime}</span>}
                        {newerRun.section && <span> ({newerRun.section}, {newerRun.critical_temp}°C, Ap/V {newerRun.section_factor})</span>}
                        <span>, use these?</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1 rounded"
                            onClick={() => {
                                const nextInputs = applyMacsRunToInputs(newerRun, timeEqInputs)
                                setTimeEqInputs(nextInputs)
                            }}
                        >
                            Use these
                        </button>
                        <button
                            type="button"
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-3 py-1 rounded"
                            onClick={() => setDismissedRunId(newerRun.run_id || newerRun.id)}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
