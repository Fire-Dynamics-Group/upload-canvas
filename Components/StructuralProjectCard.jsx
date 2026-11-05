import React, { useState } from 'react'

export function getStructuralCardMetrics(project) {
    const settings = project?.settings || {}
    const macsBatch = settings.macsBatch || null
    const timeEqInputs = settings.timeEqInputs || null
    const timeEqResult = settings.timeEqResult || null

    const totalRuns = macsBatch?.run_count || macsBatch?.summary?.total_runs || macsBatch?.total_runs || 0
    const passCount = macsBatch?.pass_count ?? macsBatch?.summary?.pass_count ?? null
    const failCount = macsBatch?.fail_count ?? macsBatch?.summary?.fail_count ?? null
    const relPct = macsBatch?.reliability_percent !== undefined
        ? macsBatch.reliability_percent
        : macsBatch?.summary?.reliability_percent !== undefined
            ? macsBatch.summary.reliability_percent
            : (totalRuns > 0 && passCount !== null ? Number(((passCount / totalRuns) * 100).toFixed(1)) : null)

    const shearCheck = macsBatch?.shear_check || {}
    const subLimitRuns = shearCheck.sub_limit_runs || []

    // Derive section from batch, inputs, or setup groups
    let derivedSection = macsBatch?.governing_section || macsBatch?.section || timeEqInputs?.section || null
    if (!derivedSection && macsBatch?.setup?.groups) {
        for (const g of macsBatch.setup.groups) {
            const f = g.fields?.find(field => field.key === 'u_sec_size' || field.key === 'side_b_sec' || field.key === 'side_a_sec')
            if (f?.value && typeof f.value === 'string' && f.value.toLowerCase() !== 'none') {
                derivedSection = f.value
                break
            }
        }
    }
    const section = derivedSection
    const criticalTemp = macsBatch?.critical_temp ?? timeEqInputs?.criticalTemp ?? null
    const sectionFactor = macsBatch?.section_factor ?? timeEqInputs?.sectionFactor ?? null
    const fireResistancePeriod = timeEqInputs?.fireResistancePeriod || 90
    const occupancy = timeEqInputs?.use || timeEqInputs?.mcOccupancy || 'Office'
    const calcType = timeEqInputs?.calcType || 'deterministic'
    const teqResult = timeEqResult?.time_equiv ?? timeEqResult?.teq ?? null

    let statusType = 'awaiting'
    let statusLabel = 'Awaiting MACS Data'
    let statusTone = 'gray'

    if (totalRuns > 0) {
        if (subLimitRuns.length > 0) {
            statusType = 'batch-shear-alert'
            statusLabel = `MACS: ${totalRuns.toLocaleString()} Runs (${subLimitRuns.length} Shear Alert${subLimitRuns.length > 1 ? 's' : ''})`
            statusTone = 'amber'
        } else {
            statusType = 'batch-ok'
            statusLabel = `MACS: ${totalRuns.toLocaleString()} Runs${relPct !== null ? ` (${relPct}%)` : ''}`
            statusTone = 'emerald'
        }
    } else if (macsBatch) {
        statusType = 'batch-linked'
        statusLabel = 'MACS Batch Linked'
        statusTone = 'emerald'
    } else if (section || criticalTemp || timeEqInputs?.macsRunId) {
        statusType = 'run-linked'
        statusLabel = 'MACS Run Linked'
        statusTone = 'blue'
    }

    // Time Equivalence Status Badge
    let teqStatusType = 'not-run'
    let teqStatusLabel = 'Time Eq: Not run'
    let teqStatusTone = 'gray'

    const hasTeqResults = Boolean(
        timeEqResult && (
            timeEqResult.reliabilityPercent !== undefined ||
            timeEqResult.time_equiv !== undefined ||
            timeEqResult.teq !== undefined
        )
    )

    if (hasTeqResults) {
        teqStatusType = 'calculated'
        if (timeEqResult.reliabilityPercent !== undefined) {
            teqStatusLabel = `Time Eq: ${timeEqResult.reliabilityPercent}% Rel.`
        } else {
            const val = Math.round(timeEqResult.time_equiv ?? timeEqResult.teq ?? 0)
            teqStatusLabel = `Time Eq: ${val}m`
        }
        teqStatusTone = 'emerald'
    } else if (project?.floors?.[0]?.elements?.length > 0) {
        teqStatusType = 'ready'
        teqStatusLabel = 'Time Eq: Ready'
        teqStatusTone = 'blue'
    } else {
        teqStatusType = 'not-run'
        teqStatusLabel = 'Time Eq: Not run'
        teqStatusTone = 'gray'
    }

    return {
        macsBatch,
        timeEqInputs,
        timeEqResult,
        totalRuns,
        passCount,
        failCount,
        relPct,
        subLimitRuns,
        section,
        criticalTemp,
        sectionFactor,
        fireResistancePeriod,
        occupancy,
        calcType,
        teqResult,
        statusType,
        statusLabel,
        statusTone,
        teqStatusType,
        teqStatusLabel,
        teqStatusTone,
        thumbnail: settings.thumbnail || null,
    }
}

export default function StructuralProjectCard({
    project,
    onOpen,
    onOpenCanvas,
    onRename,
    onDelete,
    timeAgo,
}) {
    const [showQuickPeek, setShowQuickPeek] = useState(false)
    const metrics = getStructuralCardMetrics(project)

    const badgeStyles = {
        emerald: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
        amber: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
        blue: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
        gray: 'bg-slate-900/80 text-slate-300 border-slate-700/60',
    }

    const badgeDotStyles = {
        emerald: 'bg-emerald-400',
        amber: 'bg-amber-400 animate-pulse',
        blue: 'bg-blue-400',
        gray: 'bg-slate-500',
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(project)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(project)
                }
            }}
            className="group relative bg-slate-800/90 hover:bg-slate-800 rounded-xl overflow-hidden text-left transition-all duration-200 border border-slate-700/80 hover:border-indigo-500/80 hover:shadow-xl hover:shadow-indigo-950/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 flex flex-col justify-between"
        >
            {/* Visual Top Area */}
            <div className="relative w-full h-36 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950/70 overflow-hidden border-b border-slate-700/60">
                {metrics.thumbnail ? (
                    <>
                        <img
                            src={metrics.thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-700/40 flex items-center justify-center text-xl mb-1 text-indigo-300">
                            🏛️
                        </div>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-full">
                            {metrics.section || 'MACS+ Assessment'}
                        </span>
                        <span className="text-[10px] text-slate-400">Composite Slab & Fire Resistance</span>
                    </div>
                )}

                {/* MACS & Time Eq Status Badges */}
                <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1.5 max-w-[calc(100%-80px)]">
                    <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md shadow-sm ${badgeStyles[metrics.statusTone]}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${badgeDotStyles[metrics.statusTone]}`} />
                        {metrics.statusLabel}
                    </span>
                    <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md shadow-sm ${badgeStyles[metrics.teqStatusTone]}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${badgeDotStyles[metrics.teqStatusTone]}`} />
                        {metrics.teqStatusLabel}
                    </span>
                </div>

                {/* Card Top Actions: Rename & Delete */}
                <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onRename(e, project)
                        }}
                        title="Rename project"
                        aria-label="Rename project"
                        className="p-1.5 rounded-md bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/50 backdrop-blur-sm transition-colors text-xs"
                    >
                        ✏️
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(e, project)
                        }}
                        title="Delete project"
                        aria-label="Delete project"
                        className="p-1.5 rounded-md bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-rose-400 border border-slate-700/50 backdrop-blur-sm transition-colors text-xs"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Card Content Body */}
            <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="font-semibold text-white text-base tracking-tight truncate group-hover:text-indigo-300 transition-colors">
                        {project.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {project.created_by || 'Unknown'} · {timeAgo(project.updated_at)}
                    </p>

                    {/* Key Engineering Highlights Grid */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Governing Section</span>
                            <span className="font-semibold text-slate-200 truncate block">
                                {metrics.section || '—'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Critical Temp</span>
                            <span className="font-semibold text-slate-200 block">
                                {metrics.criticalTemp ? `${metrics.criticalTemp}°C` : '—'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Target Fire Res.</span>
                            <span className="font-semibold text-slate-200 block">
                                REI {metrics.fireResistancePeriod}m
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Occupancy</span>
                            <span className="font-semibold text-slate-200 truncate block">
                                {metrics.occupancy}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons: Quick Peek & Open Assessment */}
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowQuickPeek(!showQuickPeek)
                        }}
                        className="px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors flex items-center gap-1"
                        title="View assessment summary details"
                    >
                        <span>ℹ️</span>
                        <span>Quick Peek</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onOpenCanvas(e, project)
                            }}
                            className="px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                            title="Open compartment drawing on canvas"
                        >
                            <span>📐</span>
                            <span>Plan</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpen(project)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                        >
                            <span>Open</span>
                            <span className="text-[10px]">→</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Peek Drawer / Popover Modal */}
            {showQuickPeek && (
                <div
                    className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-30 p-4 rounded-xl flex flex-col justify-between border border-indigo-500/50 text-left animate-fadeIn"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between border-b border-slate-700 pb-2">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Quick Peek</span>
                            <h4 className="font-bold text-white text-sm truncate max-w-[200px]">{project.name}</h4>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowQuickPeek(false)}
                            className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="my-2 space-y-2 text-xs overflow-y-auto max-h-[170px] pr-1">
                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">MACS+ Simulation</span>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                <div><span className="text-slate-400">Status:</span> <span className="font-medium text-slate-200">{metrics.statusLabel}</span></div>
                                <div><span className="text-slate-400">Total Runs:</span> <span className="font-medium text-slate-200">{metrics.totalRuns ? metrics.totalRuns.toLocaleString() : 'None'}</span></div>
                                <div><span className="text-slate-400">Section:</span> <span className="font-medium text-slate-200">{metrics.section || '—'}</span></div>
                                <div><span className="text-slate-400">Critical Temp:</span> <span className="font-medium text-slate-200">{metrics.criticalTemp ? `${metrics.criticalTemp}°C` : '—'}</span></div>
                                {metrics.sectionFactor && (
                                    <div><span className="text-slate-400">Ap/V:</span> <span className="font-medium text-slate-200">{metrics.sectionFactor} m⁻¹</span></div>
                                )}
                                {metrics.subLimitRuns.length > 0 && (
                                    <div className="col-span-2 text-amber-300 font-semibold">
                                        ⚠️ {metrics.subLimitRuns.length} runs below shear limit
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800/80 p-2 rounded border border-slate-700/50">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Time Equivalence</span>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                <div><span className="text-slate-400">Status:</span> <span className="font-medium text-slate-200">{metrics.teqStatusLabel}</span></div>
                                <div><span className="text-slate-400">Target:</span> <span className="font-medium text-slate-200">{metrics.fireResistancePeriod} min</span></div>
                                <div><span className="text-slate-400">Mode:</span> <span className="font-medium text-slate-200 capitalize">{metrics.calcType}</span></div>
                                <div><span className="text-slate-400">Occupancy:</span> <span className="font-medium text-slate-200">{metrics.occupancy}</span></div>
                                {metrics.teqResult && (
                                    <div><span className="text-slate-400">T_eq:</span> <span className="font-medium text-slate-200">{metrics.teqResult} min</span></div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                setShowQuickPeek(false)
                                onOpenCanvas(e, project)
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1"
                        >
                            <span>📐</span>
                            <span>Plan</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowQuickPeek(false)
                                onOpen(project)
                            }}
                            className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                        >
                            Open Assessment →
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
