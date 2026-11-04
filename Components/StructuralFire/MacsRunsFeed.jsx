import { useState, useMemo } from 'react'

function formatDateTime(dateStr) {
    if (!dateStr) return '—'
    try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return d.toLocaleDateString(undefined, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
    } catch {
        return dateStr
    }
}

export default function MacsRunsFeed({
    runs = [],
    batch = null,
    selectedProjectId = null,
    projects = [],
    selectedRunId = null,
    onSelectRun,
    onClaimHandoff,
    isClaiming = false,
    activeTimeEqInputs = null,
    onViewBatchOverview = null,
}) {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterTag, setFilterTag] = useState('all') // 'all' | 'governing' | 'failed'
    const [projectScope, setProjectScope] = useState('thisProject') // 'thisProject' | 'all'
    const [handoffInput, setHandoffInput] = useState('')
    const [claimError, setClaimError] = useState(null)

    // Map project ID to human-readable name
    const projectsMap = useMemo(() => {
        const map = {}
        for (const p of projects) {
            if (p && p.id) map[p.id] = p.name
        }
        return map
    }, [projects])

    // Count runs for current project
    const thisProjectCount = useMemo(() => {
        if (!selectedProjectId) return runs.length
        return runs.filter((r) => r.project_id === selectedProjectId).length
    }, [runs, selectedProjectId])

    // Filter runs by scope, tag, and search
    const filteredRuns = useMemo(() => {
        let list = runs

        // 1. Project scope filter
        if (projectScope === 'thisProject' && selectedProjectId) {
            list = list.filter((r) => r.project_id === selectedProjectId)
        }

        // 2. Status tag filter
        if (filterTag === 'failed') {
            list = list.filter((r) => {
                const checks = Array.isArray(r.checks) ? r.checks : []
                return checks.some((c) => !c.pass) || (r.outputs?.uf_max > 1.001) || r.error
            })
        } else if (filterTag === 'governing') {
            list = list.filter((r) => (r.label || '').toLowerCase().includes('governing') || (r.tag === 'governing'))
        }

        // 3. Search query filter
        if (!searchTerm.trim()) return list
        const q = searchTerm.toLowerCase()
        return list.filter((r) => {
            const sec = (r.section || '').toLowerCase()
            const label = (r.label || '').toLowerCase()
            const user = (r.windows_user || '').toLowerCase()
            const machine = (r.machine_name || '').toLowerCase()
            const pName = (projectsMap[r.project_id] || '').toLowerCase()
            return sec.includes(q) || label.includes(q) || user.includes(q) || machine.includes(q) || pName.includes(q)
        })
    }, [runs, selectedProjectId, projectScope, filterTag, searchTerm, projectsMap])

    const handleClaim = async (e) => {
        e.preventDefault()
        if (!handoffInput.trim() || !onClaimHandoff) return
        setClaimError(null)
        try {
            await onClaimHandoff(handoffInput.trim())
            setHandoffInput('')
        } catch (err) {
            setClaimError(err.message || 'Failed to claim handoff')
        }
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            {/* Linked Batch Banner */}
            {batch && (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-blue-950 font-mono tracking-tight">
                            {batch.name || `Batch ${batch.batch_id?.slice(0, 8)}`}
                        </span>
                        {(batch.reliability_percent !== undefined || batch.summary?.reliability_percent !== undefined) && (
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded">
                                {batch.reliability_percent !== undefined ? batch.reliability_percent : batch.summary?.reliability_percent}% Rel.
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-blue-800/80 mt-0.5 font-mono flex items-center justify-between">
                        <span>
                            {(batch.run_count || batch.summary?.total_runs || 0).toLocaleString()} runs ·{' '}
                            {(batch.pass_count ?? batch.summary?.pass_count ?? 0).toLocaleString()} pass ·{' '}
                            {(batch.fail_count ?? batch.summary?.fail_count ?? 0).toLocaleString()} fail
                        </span>
                        {onViewBatchOverview && (
                            <button
                                type="button"
                                onClick={onViewBatchOverview}
                                className="text-blue-700 underline font-semibold hover:text-blue-900"
                            >
                                Overview →
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Header, Scope Toggle & Search */}
            <div className="p-3 border-b border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span>MACS Runs Feed</span>
                        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                            {filteredRuns.length}
                        </span>
                    </h3>
                </div>

                {/* Project Scope Toggle */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded text-[11px] font-semibold">
                    <button
                        type="button"
                        onClick={() => setProjectScope('thisProject')}
                        className={`py-1 rounded text-center transition-colors ${
                            projectScope === 'thisProject'
                                ? 'bg-white text-blue-700 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        This Project ({thisProjectCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setProjectScope('all')}
                        className={`py-1 rounded text-center transition-colors ${
                            projectScope === 'all'
                                ? 'bg-white text-blue-700 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        All Cloud ({runs.length})
                    </button>
                </div>

                {/* Search input */}
                <input
                    type="text"
                    placeholder="Search section, project, user..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />

                {/* Filter tags */}
                <div className="flex gap-1 pt-0.5">
                    <button
                        type="button"
                        onClick={() => setFilterTag('all')}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                            filterTag === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTag('governing')}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                            filterTag === 'governing' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                    >
                        Governing
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterTag('failed')}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                            filterTag === 'failed' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                    >
                        Failed
                    </button>
                </div>
            </div>

            {/* Runs List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-[660px]">
                {filteredRuns.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 italic space-y-1">
                        <p>{searchTerm ? 'No runs match your search.' : 'No MACS runs in this view.'}</p>
                        {projectScope === 'thisProject' && runs.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setProjectScope('all')}
                                className="text-blue-600 underline font-semibold text-[11px]"
                            >
                                View all {runs.length} cloud runs →
                            </button>
                        )}
                    </div>
                ) : (
                    filteredRuns.map((r, idx) => {
                        const isSelected = (r.id && r.id === selectedRunId) || (r.run_id && r.run_id === selectedRunId)
                        const pName = projectsMap[r.project_id] || (r.project_id ? 'Other Project' : 'Unassigned')
                        const isCurrentProject = selectedProjectId && r.project_id === selectedProjectId

                        const checks = Array.isArray(r.checks) ? r.checks : []
                        const hasFailed = checks.some((c) => !c.pass) || (r.outputs?.uf_max > 1.001) || r.error

                        // Check if in use by active timeEq inputs
                        const inUse = activeTimeEqInputs &&
                            activeTimeEqInputs.criticalTemp === r.critical_temp &&
                            activeTimeEqInputs.section === r.section

                        return (
                            <button
                                key={r.id || r.run_id || idx}
                                type="button"
                                onClick={() => onSelectRun(r)}
                                className={`w-full text-left p-3.5 transition-colors ${
                                    isSelected
                                        ? 'bg-blue-50/80 border-l-4 border-blue-600'
                                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                                }`}
                            >
                                {/* Project badge & status */}
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1.5 gap-2">
                                    <span className="flex items-center gap-1 font-semibold text-slate-700 truncate" title={`Project: ${pName}`}>
                                        <span className="text-slate-400">🏢</span>
                                        <span className="truncate">{pName}</span>
                                    </span>
                                    {isCurrentProject ? (
                                        <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                                            Current
                                        </span>
                                    ) : (
                                        <span className="text-[9px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.2 rounded shrink-0">
                                            Linked
                                        </span>
                                    )}
                                </div>

                                {/* Run Title & Critical Temp */}
                                <div className="flex items-start justify-between gap-1.5">
                                    <div className="truncate">
                                        <span className="text-xs font-bold text-slate-900 block truncate">
                                            {r.label || r.section || 'MACS Run'}
                                        </span>
                                        {r.label && r.section && (
                                            <span className="text-[11px] font-semibold text-slate-600 block truncate font-mono">
                                                {r.section}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-xs font-extrabold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded tabular-nums font-mono">
                                            {Math.round(r.critical_temp)}°C
                                        </span>
                                        <span
                                            className={`text-[9px] font-bold px-1 py-0.2 rounded font-mono ${
                                                hasFailed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                        >
                                            {hasFailed ? 'FAIL' : 'PASS'}
                                        </span>
                                    </div>
                                </div>

                                {/* Beam details & In Use badge */}
                                <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                                    <span>
                                        Side {r.governing_side || 'A'} • Ap/V {r.section_factor || 140}
                                    </span>
                                    {inUse && (
                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                            In Use
                                        </span>
                                    )}
                                </div>

                                {/* Audit trail: Ran, By, Received */}
                                <div className="text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100 space-y-0.5 font-mono">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">⚙️ Ran:</span>
                                        <span className="text-slate-700">{formatDateTime(r.client_timestamp)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">💻 By:</span>
                                        <span className="text-slate-700 truncate ml-1">
                                            {r.windows_user || 'user'} on {r.machine_name || 'desktop'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">☁️ Received:</span>
                                        <span className="text-slate-700">{formatDateTime(r.received_at)}</span>
                                    </div>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>

            {/* Claim Handoff Form */}
            {onClaimHandoff && (
                <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <form onSubmit={handleClaim} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-700">Link Run via Handoff ID:</span>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                placeholder="Paste handoff ID..."
                                value={handoffInput}
                                onChange={(e) => setHandoffInput(e.target.value)}
                                disabled={isClaiming}
                                className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={isClaiming || !handoffInput.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
                            >
                                {isClaiming ? '...' : 'Claim'}
                            </button>
                        </div>
                        {claimError && <span className="text-[10px] text-rose-600">{claimError}</span>}
                    </form>
                </div>
            )}
        </div>
    )
}
