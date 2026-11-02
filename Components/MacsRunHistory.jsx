import { useState } from 'react'
import useStore from '../store/useStore'
import { isRunMatchingInputs, applyMacsRunToInputs } from '../utils/macsHandoff'
import { claimHandoff, getMacsRuns } from './ApiCalls'

export default function MacsRunHistory() {
    const projectId = useStore((state) => state.projectId)
    const macsRuns = useStore((state) => state.macsRuns)
    const setMacsRuns = useStore((state) => state.setMacsRuns)
    const timeEqInputs = useStore((state) => state.timeEqInputs)
    const setTimeEqInputs = useStore((state) => state.setTimeEqInputs)
    const setMacsNotice = useStore((state) => state.setMacsNotice)

    const [handoffInput, setHandoffInput] = useState('')
    const [isClaiming, setIsClaiming] = useState(false)
    const [claimError, setClaimError] = useState(null)

    const handleClaim = async (e) => {
        e.preventDefault()
        if (!handoffInput.trim() || !projectId) return
        setIsClaiming(true)
        setClaimError(null)
        try {
            await claimHandoff(projectId, handoffInput.trim())
            const updatedRuns = await getMacsRuns(projectId)
            setMacsRuns(updatedRuns)
            if (updatedRuns && updatedRuns.length > 0) {
                // Apply the newly claimed run
                const nextInputs = applyMacsRunToInputs(updatedRuns[0], timeEqInputs)
                setTimeEqInputs(nextInputs)
            }
            setHandoffInput('')
            setMacsNotice({ type: 'success', message: 'Handoff claimed successfully.' })
        } catch (err) {
            setClaimError(err.message || 'Failed to claim handoff')
        } finally {
            setIsClaiming(false)
        }
    }

    const runs = Array.isArray(macsRuns) ? macsRuns : []

    return (
        <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="text-base font-bold text-gray-800 mb-2">MACS Run History</h3>

            {/* Claim handoff form */}
            {projectId && (
                <form onSubmit={handleClaim} className="flex gap-2 items-center mb-3">
                    <input
                        type="text"
                        placeholder="Paste handoff ID to link run"
                        className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                        value={handoffInput}
                        onChange={(e) => setHandoffInput(e.target.value)}
                        disabled={isClaiming}
                    />
                    <button
                        type="submit"
                        disabled={isClaiming || !handoffInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
                    >
                        {isClaiming ? 'Claiming…' : 'Claim'}
                    </button>
                    {claimError && <span className="text-xs text-red-600 ml-2">{claimError}</span>}
                </form>
            )}

            {runs.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No MACs runs recorded for this project yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="p-2 font-semibold">Section</th>
                                <th className="p-2 font-semibold">Exposure</th>
                                <th className="p-2 font-semibold">Crit. Temp</th>
                                <th className="p-2 font-semibold">Sec. Factor</th>
                                <th className="p-2 font-semibold">Gov. Side</th>
                                <th className="p-2 font-semibold">Label</th>
                                <th className="p-2 font-semibold">User</th>
                                <th className="p-2 font-semibold">Machine</th>
                                <th className="p-2 font-semibold">When</th>
                                <th className="p-2 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r, idx) => {
                                const inUse = isRunMatchingInputs(r, timeEqInputs)
                                const timestamp = r.client_timestamp || r.received_at
                                const timeStr = timestamp ? new Date(timestamp).toLocaleString() : '-'
                                return (
                                    <tr
                                        key={r.id || r.run_id || idx}
                                        className={`border-b border-gray-100 ${inUse ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="p-2">{r.section || '-'}</td>
                                        <td className="p-2">{r.exposure || '-'}</td>
                                        <td className="p-2">{r.critical_temp !== undefined ? `${r.critical_temp} °C` : '-'}</td>
                                        <td className="p-2">{r.section_factor !== undefined ? `${r.section_factor} m⁻¹` : '-'}</td>
                                        <td className="p-2">{r.governing_side || '-'}</td>
                                        <td className="p-2">{r.label || '-'}</td>
                                        <td className="p-2">{r.windows_user || '-'}</td>
                                        <td className="p-2">{r.machine_name || '-'}</td>
                                        <td className="p-2">{timeStr}</td>
                                        <td className="p-2">
                                            {inUse ? (
                                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-semibold">
                                                    In use
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-2 py-0.5 rounded"
                                                    onClick={() => {
                                                        const nextInputs = applyMacsRunToInputs(r, timeEqInputs)
                                                        setTimeEqInputs(nextInputs)
                                                    }}
                                                >
                                                    Use these
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
