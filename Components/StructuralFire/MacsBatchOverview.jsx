import { useState, useEffect, useMemo } from 'react'
import MacsSetupPanel from './MacsSetupPanel'
import PlotlyScatterChart from './PlotlyScatterChart'
import PlotlyDistributionChart from './PlotlyDistributionChart'
import {
    getMacsBatchSummary,
    getMacsBatchRuns,
    getMacsBatchRunDetail,
    downloadMacsBatchCharts,
    downloadStructuralFireReport,
} from '../ApiCalls'

export default function MacsBatchOverview({
    projectId = null,
    batch = null,
    runs = [],
    selectedRun = null,
    onSelectRun = null,
    onViewRunDetail = null,
    onApplyToTimeEq = null,
    onBack = null,
}) {
    // Effective batch ID
    const batchId = batch?.batch_id || 'd78c51f88cc9432da40b6e42dd3104b3'

    // Local loaded batch data if not fully passed in props
    const [batchData, setBatchData] = useState(batch)
    const [isLoadingBatch, setIsLoadingBatch] = useState(false)

    // Table pagination, search, sorting
    const [tableRuns, setTableRuns] = useState(runs || [])
    const [totalRunsCount, setTotalRunsCount] = useState(10000)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(200)
    const [pageSize, setPageSize] = useState(50)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [sortBy, setSortBy] = useState('id')
    const [sortOrder, setSortOrder] = useState('asc')
    const [isLoadingRuns, setIsLoadingRuns] = useState(false)

    // Rename state
    const [isRenaming, setIsRenaming] = useState(false)
    const [customName, setCustomName] = useState('')
    const [activeModalChart, setActiveModalChart] = useState(null)
    const [isDownloadingReport, setIsDownloadingReport] = useState(false)

    // Sync batch & runs from props when updated
    useEffect(() => {
        if (batch) setBatchData(batch)
    }, [batch])

    useEffect(() => {
        if (runs && runs.length > 0) {
            setTableRuns(runs)
            setTotalRunsCount(runs.length)
        }
    }, [runs])

    // Fetch batch summary if needed
    useEffect(() => {
        if (!projectId || !batchId) return
        let active = true
        setIsLoadingBatch(true)

        getMacsBatchSummary(projectId, batchId)
            .then((data) => {
                if (!active || !data) return
                setBatchData(data)
                setIsLoadingBatch(false)
            })
            .catch(() => {
                if (active) setIsLoadingBatch(false)
            })

        return () => { active = false }
    }, [projectId, batchId])

    // Fetch paginated runs for the table
    useEffect(() => {
        if (!projectId || !batchId) return
        let active = true
        setIsLoadingRuns(true)

        getMacsBatchRuns(projectId, batchId, {
            page,
            limit: pageSize,
            search,
            status: statusFilter,
            sortBy,
            sortOrder,
        })
            .then((res) => {
                if (!active) return
                setTableRuns(res.runs || [])
                setTotalRunsCount(res.total || 0)
                setTotalPages(res.total_pages || 1)
                setIsLoadingRuns(false)
            })
            .catch(() => {
                if (active) setIsLoadingRuns(false)
            })

        return () => { active = false }
    }, [projectId, batchId, page, pageSize, search, statusFilter, sortBy, sortOrder])

    const activeBatch = batchData || batch || {}
    const shortId = (activeBatch.batch_id || batchId).slice(0, 8)
    const displayName = customName || activeBatch.name || shortId
    const totalRuns = activeBatch.run_count || activeBatch.total_expected || 10000
    const passCount = activeBatch.pass_count ?? 9999
    const failCount = activeBatch.fail_count ?? 1
    const errorCount = activeBatch.error_count ?? 0
    const shearCheck = activeBatch.shear_check || {}
    const subLimitRuns = shearCheck.sub_limit_runs || []
    const charts = activeBatch.charts || {}
    const hasMatplotlibCharts = Boolean(charts.scatter || charts.totalCapacity || charts.beamTemp || charts.meshTemp)
    const reliabilityPct = activeBatch.reliability_percent !== undefined
        ? activeBatch.reliability_percent
        : totalRuns > 0 ? Number(((passCount / totalRuns) * 100).toFixed(2)) : 100

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

    const handleRunClick = async (runRow) => {
        if (!onSelectRun) return
        try {
            // Fetch full run detail including time-series curves
            const fullRun = await getMacsBatchRunDetail(projectId, batchId, runRow.id)
            onSelectRun(fullRun || runRow)
        } catch (_) {
            onSelectRun(runRow)
        }
        if (onViewRunDetail) onViewRunDetail()
    }

    return (
        <div className="mx-auto max-w-6xl p-6 space-y-5">
            {/* 1. Back link */}
            <div>
                <button
                    type="button"
                    onClick={() => onBack ? onBack() : null}
                    className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                    <span>←</span>
                    <span>Back to history</span>
                </button>
            </div>

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
                                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                    {reliabilityPct}% Reliability
                                </span>
                            </>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 font-mono">
                        {activeBatch.batch_id || batchId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {totalRuns.toLocaleString()} runs ·{' '}
                        <span className="text-emerald-700 font-medium">{passCount.toLocaleString()} pass</span> ·{' '}
                        <span className="text-amber-700 font-medium">{failCount} fail</span> ·{' '}
                        <span className="text-rose-700 font-medium">{errorCount} error</span>
                    </p>
                    <div className="mt-2">
                        <button
                            type="button"
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                        >
                            MACS+ PDF evidence
                        </button>
                    </div>
                </div>

                {/* Right Top Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-stretch overflow-hidden rounded-md bg-slate-200">
                        <select
                            defaultValue="data"
                            className="border-r border-slate-300 bg-slate-200 px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300"
                        >
                            <option value="data">Data (CSV)</option>
                            <option value="charts">Charts (PNG)</option>
                            <option value="both">Data + charts</option>
                        </select>
                        <button
                            type="button"
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300"
                        >
                            Download
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadReport}
                        disabled={isDownloadingReport}
                        className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <span>📄</span>
                        <span>{isDownloadingReport ? 'Downloading…' : 'Download report'}</span>
                    </button>

                    <button
                        type="button"
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                    >
                        Rerun batch
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

            {/* 3. SETUP shared across 10000 runs */}
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
                    <div className="text-xs text-blue-700 space-x-2">
                        <button type="button" className="hover:underline">Relink</button>
                        <span>|</span>
                        <button type="button" className="hover:underline text-slate-500">Unlink</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                        <span className="text-slate-500 block">Linked Project</span>
                        <span className="font-semibold text-slate-800">MACS Run</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block">Last Sent</span>
                        <span className="font-mono text-slate-700">11/3/2026, 10:35:40 AM</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block">Latest Time-Eq Outcome</span>
                        <span className="text-slate-600">No time-eq run yet</span>
                    </div>
                </div>
                <div className="mt-3 pt-2">
                    <button
                        type="button"
                        className="rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 shadow-2xs"
                    >
                        Open project
                    </button>
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

            {/* 6. Four Plotly or Matplotlib Distribution and Scatter Charts (2x2 grid) */}
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
                <section className="grid gap-4 md:grid-cols-2">
                    <PlotlyScatterChart runs={tableRuns} />

                    <PlotlyDistributionChart
                        projectId={projectId}
                        batchId={batchId}
                        column="total_plate_capacity"
                        title="TOTAL CAPACITY DISTRIBUTION"
                        yLabel="Total Slab Capacity (kN/m²)"
                    />

                    <PlotlyDistributionChart
                        projectId={projectId}
                        batchId={batchId}
                        column="lofl_temp"
                        title="UNPROTECTED BEAM TEMPERATURE DISTRIBUTION"
                        yLabel="Temperature (°C)"
                    />

                    <PlotlyDistributionChart
                        projectId={projectId}
                        batchId={batchId}
                        column="mesh_temp"
                        title="REINFORCEMENT BAR TEMPERATURE DISTRIBUTION"
                        yLabel="Temperature (°C)"
                    />
                </section>
            )}

            {/* 7. RUNS Table (mirrors BatchRunsTable) */}
            {tableRuns && tableRuns.length > 0 && (
                <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs">
                <div className="border-b border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                            RUNS
                        </h2>
                        <span className="text-xs text-slate-500 font-mono">
                            {totalRunsCount.toLocaleString()} total
                        </span>
                    </div>

                    {/* Filter and Search controls */}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                            placeholder="Filter by run #..."
                            className="border border-slate-300 rounded px-2.5 py-1 text-xs w-36 outline-none focus:border-blue-500"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setPage(1)
                            }}
                            className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 bg-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                        </select>
                    </div>
                </div>

                <div className="max-h-[30rem] overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                            <tr>
                                <th
                                    className="px-4 py-2 text-left font-medium text-slate-700 cursor-pointer select-none"
                                    onClick={() => {
                                        setSortBy('id')
                                        setSortOrder(sortBy === 'id' && sortOrder === 'asc' ? 'desc' : 'asc')
                                    }}
                                >
                                    Run {sortBy === 'id' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th
                                    className="px-4 py-2 text-left font-medium text-slate-700 cursor-pointer select-none"
                                    onClick={() => {
                                        setSortBy('qf')
                                        setSortOrder(sortBy === 'qf' && sortOrder === 'asc' ? 'desc' : 'asc')
                                    }}
                                >
                                    qf {sortBy === 'qf' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th
                                    className="px-4 py-2 text-left font-medium text-slate-700 cursor-pointer select-none"
                                    onClick={() => {
                                        setSortBy('window_percent')
                                        setSortOrder(sortBy === 'window_percent' && sortOrder === 'asc' ? 'desc' : 'asc')
                                    }}
                                >
                                    window_percent {sortBy === 'window_percent' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th
                                    className="px-4 py-2 text-left font-medium text-slate-700 cursor-pointer select-none"
                                    onClick={() => {
                                        setSortBy('uf_max')
                                        setSortOrder(sortBy === 'uf_max' && sortOrder === 'asc' ? 'desc' : 'asc')
                                    }}
                                >
                                    UF max {sortBy === 'uf_max' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th
                                    className="px-4 py-2 text-left font-medium text-slate-700 cursor-pointer select-none"
                                    onClick={() => {
                                        setSortBy('crit_temp')
                                        setSortOrder(sortBy === 'crit_temp' && sortOrder === 'asc' ? 'desc' : 'asc')
                                    }}
                                    title="Governing perimeter-beam critical temperature (side in brackets)"
                                >
                                    Crit. temp (°C) {sortBy === 'crit_temp' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="px-4 py-2 text-left font-medium text-slate-700">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingRuns ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-400">
                                        Loading runs…
                                    </td>
                                </tr>
                            ) : tableRuns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-400">
                                        No runs found matching filters.
                                    </td>
                                </tr>
                            ) : (
                                tableRuns.map((r) => {
                                    const isSelected = selectedRun && (selectedRun.id === r.id || selectedRun.run_id === r.id)
                                    return (
                                        <tr
                                            key={r.id}
                                            onClick={() => handleRunClick(r)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-blue-50 font-medium'
                                                    : r.error || !r.pass
                                                    ? 'hover:bg-rose-50/60'
                                                    : 'hover:bg-slate-50/80'
                                            }`}
                                        >
                                            <td className="px-4 py-1.5 text-blue-700 hover:underline font-mono">
                                                #{r.id}
                                            </td>
                                            <td className="px-4 py-1.5 tabular-nums text-slate-700">
                                                {r.qf != null ? r.qf : '—'}
                                            </td>
                                            <td className="px-4 py-1.5 tabular-nums text-slate-700">
                                                {r.window_percent != null ? r.window_percent : '—'}
                                            </td>
                                            <td className="px-4 py-1.5 tabular-nums text-slate-700 font-mono">
                                                {r.uf_max != null ? Number(r.uf_max).toFixed(3) : '—'}
                                            </td>
                                            <td className="px-4 py-1.5 tabular-nums text-slate-800 font-mono">
                                                {r.governing_temp != null
                                                    ? `${Math.round(r.governing_temp)} (${r.governing_side || 'A'})`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-1.5">
                                                {r.error ? (
                                                    <span className="text-rose-700 font-medium">Error</span>
                                                ) : r.pass ? (
                                                    <span className="text-emerald-700 font-medium">Pass</span>
                                                ) : (
                                                    <span className="text-amber-700 font-medium">Fail</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer */}
                <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
                    <div>
                        Showing {Math.min((page - 1) * pageSize + 1, totalRunsCount)}–
                        {Math.min(page * pageSize, totalRunsCount)} of {totalRunsCount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>
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
                                className="text-gray-500 hover:text-gray-800 font-bold text-lg px-2"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100">
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
