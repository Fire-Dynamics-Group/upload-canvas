import { useState, useEffect } from 'react'
import MacsSetupPanel from './MacsSetupPanel'
import {
    getMacsBatchSummary,
    downloadMacsBatchCharts,
    downloadStructuralFireReport,
} from '../ApiCalls'

export default function MacsBatchOverview({
    projectId = null,
    batch = null,
    selectedRun = null,
    onApplyToTimeEq = null,
    onBack = null,
}) {
    // Effective batch ID
    const batchId = batch?.batch_id || selectedRun?.batch_id || selectedRun?.inputs?.batch_id || null

    // Local loaded batch data if not fully passed in props
    const [batchData, setBatchData] = useState(batch)
    const [isLoadingBatch, setIsLoadingBatch] = useState(false)

    // Rename state
    const [isRenaming, setIsRenaming] = useState(false)
    const [customName, setCustomName] = useState('')
    const [activeModalChart, setActiveModalChart] = useState(null)
    const [isDownloadingReport, setIsDownloadingReport] = useState(false)

    // Sync batch from props when updated
    useEffect(() => {
        setBatchData(batch ?? null)
        setIsLoadingBatch(false)
    }, [batch])

    // Fetch batch summary if needed
    useEffect(() => {
        if (!projectId || !batchId) {
            setIsLoadingBatch(false)
            return
        }
        if (batch && (batch.charts || batch.setup || batch.run_count)) {
            setIsLoadingBatch(false)
            return
        }
        let active = true
        setIsLoadingBatch(true)

        getMacsBatchSummary(projectId, batchId)
            .then((data) => {
                if (!active) return
                if (data) setBatchData(data)
                setIsLoadingBatch(false)
            })
            .catch(() => {
                if (active) setIsLoadingBatch(false)
            })

        return () => { active = false }
    }, [projectId, batchId])

    const activeBatch = batchData || batch || {}
    const rawBatchId = activeBatch.batch_id || batchId || ''
    const shortId = rawBatchId ? String(rawBatchId).slice(0, 8) : ''
    const displayName = customName || activeBatch.name || (shortId ? `Batch ${shortId}` : 'MACS+ Assessment')
    const totalRuns = activeBatch.run_count || activeBatch.summary?.total_runs || activeBatch.total_expected || 0
    const passCount = activeBatch.pass_count ?? activeBatch.summary?.pass_count ?? 0
    const failCount = activeBatch.fail_count ?? activeBatch.summary?.fail_count ?? 0
    const errorCount = activeBatch.error_count ?? activeBatch.summary?.error_count ?? 0
    const shearCheck = activeBatch.shear_check || {}
    const subLimitRuns = shearCheck.sub_limit_runs || []
    const charts = activeBatch.charts || {}
    const hasMatplotlibCharts = Boolean(charts.scatter || charts.totalCapacity || charts.beamTemp || charts.meshTemp)
    const reliabilityPct = activeBatch.reliability_percent !== undefined
        ? activeBatch.reliability_percent
        : activeBatch.summary?.reliability_percent !== undefined
            ? activeBatch.summary.reliability_percent
            : totalRuns > 0
                ? Number(((passCount / totalRuns) * 100).toFixed(2))
                : null

    const handleDownloadReport = async () => {
        if (!projectId) {
            alert('Please select or create a project first.')
            return
        }
        setIsDownloadingReport(true)
        try {
            await downloadStructuralFireReport(projectId, activeBatch.name || 'Structural_Fire_Assessment')
        } catch (err) {
            alert(`Failed to download report: ${err.message}`)
        } finally {
            setIsDownloadingReport(false)
        }
    }

    if (isLoadingBatch && !batchData && !batch) {
        return (
            <div className="mx-auto max-w-4xl p-10 text-center bg-white rounded-lg border border-slate-200 shadow-xs space-y-4 my-8">
                <div className="text-sm text-slate-500">Loading MACS batch data…</div>
            </div>
        )
    }

    if (!rawBatchId && !hasMatplotlibCharts && totalRuns === 0) {
        return (
            <div className="mx-auto max-w-4xl p-10 text-center bg-white rounded-lg border border-slate-200 shadow-xs space-y-4 my-8">
                <div className="text-4xl">🏢🔥</div>
                <h2 className="text-lg font-bold text-slate-800">No MACS+ Simulation Batch Linked</h2>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                    This project does not have a linked MACS+ composite slab simulation batch yet. Run a 10,000-run Monte Carlo batch in the <span className="font-semibold text-slate-700">i-macs</span> desktop application and link it to transfer the 4 assessment charts and governing beam temperatures.
                </p>
                <p className="text-xs text-slate-400">
                    Once linked, the 4 Matplotlib batch charts, bay setup parameters, and failure probability envelopes will display here.
                </p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl p-6 space-y-5">
            {/* 1. Back link */}
            {onBack && (
                <div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                        <span>←</span>
                        <span>Back</span>
                    </button>
                </div>
            )}

            {/* 2. Top Header Bar */}
            <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <div className="flex items-baseline gap-2">
                        {isRenaming ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder={shortId}
                                    className="border border-slate-300 rounded px-2 py-0.5 text-lg font-semibold"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsRenaming(false)}
                                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsRenaming(false)}
                                    className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 font-mono">
                                    {displayName}
                                </h1>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomName(activeBatch.name || shortId)
                                        setIsRenaming(true)
                                    }}
                                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                    Rename
                                </button>
                                {reliabilityPct !== null && (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                        {reliabilityPct}% Reliability
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    {rawBatchId && (
                        <p className="mt-0.5 text-xs text-slate-500 font-mono">
                            {rawBatchId}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                        {totalRuns.toLocaleString()} runs ·{' '}
                        <span className="text-emerald-700 font-medium">{passCount.toLocaleString()} pass</span> ·{' '}
                        <span className="text-amber-700 font-medium">{failCount} fail</span> ·{' '}
                        <span className="text-rose-700 font-medium">{errorCount} error</span>
                    </p>
                </div>

                {/* Right Top Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleDownloadReport}
                        disabled={isDownloadingReport}
                        className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <span>📄</span>
                        <span>{isDownloadingReport ? 'Downloading…' : 'Download report (.docx)'}</span>
                    </button>

                    {onApplyToTimeEq && selectedRun && (
                        <button
                            type="button"
                            onClick={() => onApplyToTimeEq(selectedRun)}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 flex items-center gap-1 shadow-2xs"
                        >
                            <span>⚡</span>
                            <span>Apply Governing Beam to Time Eq</span>
                        </button>
                    )}
                </div>
            </header>

            {/* 3. SETUP shared across runs */}
            {activeBatch.setup && (
                <MacsSetupPanel
                    setup={activeBatch.setup}
                    runCount={totalRuns}
                    defaultOpen={true}
                />
            )}

            {/* 4. UPLOAD CANVAS LINK panel */}
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        UPLOAD CANVAS LINK
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                        <span className="text-slate-500 block">Linked Project</span>
                        <span className="font-semibold text-slate-800">{projectId || '—'}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block">Last Sent</span>
                        <span className="font-mono text-slate-700">{activeBatch.updated_at || activeBatch.created_at || '—'}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block">Latest Time-Eq Outcome</span>
                        <span className="text-slate-600">{activeBatch.time_eq_outcome || '—'}</span>
                    </div>
                </div>
            </div>

            {/* 5. Degree of shear connection advisory */}
            {subLimitRuns.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
                    Degree of shear connection: all checked beams meet the EN 1994-1-1 minimum.
                </div>
            ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                    <span className="font-bold">Degree of shear connection below the EN 1994-1-1 minimum</span>
                    <p className="mt-1 text-amber-800">
                        {subLimitRuns.length} run{subLimitRuns.length === 1 ? '' : 's'} fall below the minimum.
                    </p>
                </div>
            )}

            {/* 6. Four Matplotlib Distribution and Scatter Charts (2x2 grid) */}
            {hasMatplotlibCharts ? (
                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                MACS+ Monte Carlo Batch Charts
                            </h2>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                                N = {totalRuns.toLocaleString()} runs
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => downloadMacsBatchCharts(charts, activeBatch.name || shortId)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 shadow-2xs"
                            title="Download all 4 charts as PNG files"
                        >
                            <span>📥</span>
                            <span>Download Charts (PNG)</span>
                        </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {charts.scatter && (
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                                        Failure Mechanism & Capacity Scatter
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModalChart({
                                            title: 'Failure Mechanism & Capacity Scatter',
                                            src: `data:image/png;base64,${charts.scatter}`,
                                        })}
                                        className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded hover:bg-slate-100"
                                        title="Enlarge"
                                    >
                                        🔍
                                    </button>
                                </div>
                                <div
                                    className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-slate-100 flex-1 flex items-center justify-center p-1"
                                    onClick={() => setActiveModalChart({
                                        title: 'Failure Mechanism & Capacity Scatter',
                                        src: `data:image/png;base64,${charts.scatter}`,
                                    })}
                                >
                                    <img
                                        src={`data:image/png;base64,${charts.scatter}`}
                                        alt="Failure Mechanism and Capacity Scatter"
                                        className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                    />
                                </div>
                            </div>
                        )}

                        {charts.totalCapacity && (
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                                        Total Slab Capacity Distribution
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModalChart({
                                            title: 'Total Slab Capacity Distribution',
                                            src: `data:image/png;base64,${charts.totalCapacity}`,
                                        })}
                                        className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded hover:bg-slate-100"
                                        title="Enlarge"
                                    >
                                        🔍
                                    </button>
                                </div>
                                <div
                                    className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-slate-100 flex-1 flex items-center justify-center p-1"
                                    onClick={() => setActiveModalChart({
                                        title: 'Total Slab Capacity Distribution',
                                        src: `data:image/png;base64,${charts.totalCapacity}`,
                                    })}
                                >
                                    <img
                                        src={`data:image/png;base64,${charts.totalCapacity}`}
                                        alt="Total Slab Capacity Distribution"
                                        className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                    />
                                </div>
                            </div>
                        )}

                        {charts.beamTemp && (
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                                        Unprotected Beam Temperature Distribution
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModalChart({
                                            title: 'Unprotected Beam Temperature Distribution',
                                            src: `data:image/png;base64,${charts.beamTemp}`,
                                        })}
                                        className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded hover:bg-slate-100"
                                        title="Enlarge"
                                    >
                                        🔍
                                    </button>
                                </div>
                                <div
                                    className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-slate-100 flex-1 flex items-center justify-center p-1"
                                    onClick={() => setActiveModalChart({
                                        title: 'Unprotected Beam Temperature Distribution',
                                        src: `data:image/png;base64,${charts.beamTemp}`,
                                    })}
                                >
                                    <img
                                        src={`data:image/png;base64,${charts.beamTemp}`}
                                        alt="Unprotected Beam Temperature Distribution"
                                        className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                    />
                                </div>
                            </div>
                        )}

                        {charts.meshTemp && (
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                                        Reinforcement Bar Temperature Distribution
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModalChart({
                                            title: 'Reinforcement Bar Temperature Distribution',
                                            src: `data:image/png;base64,${charts.meshTemp}`,
                                        })}
                                        className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded hover:bg-slate-100"
                                        title="Enlarge"
                                    >
                                        🔍
                                    </button>
                                </div>
                                <div
                                    className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-slate-100 flex-1 flex items-center justify-center p-1"
                                    onClick={() => setActiveModalChart({
                                        title: 'Reinforcement Bar Temperature Distribution',
                                        src: `data:image/png;base64,${charts.meshTemp}`,
                                    })}
                                >
                                    <img
                                        src={`data:image/png;base64,${charts.meshTemp}`}
                                        alt="Reinforcement Bar Temperature Distribution"
                                        className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            ) : (
                <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-2xs">
                    Charts will appear here once a simulation batch is run in i-macs and pushed to this project.
                </div>
            )}

            {/* Chart Lightbox Modal */}
            {activeModalChart && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setActiveModalChart(null)}
                >
                    <div
                        className="bg-white rounded-lg max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                            <span className="font-bold text-sm text-gray-900">{activeModalChart.title}</span>
                            <button
                                type="button"
                                onClick={() => setActiveModalChart(null)}
                                className="text-gray-400 hover:text-gray-700 font-bold px-2 py-1 text-sm rounded hover:bg-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-50">
                            <img
                                src={activeModalChart.src}
                                alt={activeModalChart.title}
                                className="max-w-full max-h-[75vh] object-contain rounded shadow"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
