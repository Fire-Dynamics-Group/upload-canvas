import { useState, useEffect } from 'react'
import {
    OCCUPANCY_DISTRIBUTIONS,
    GROWTH_RATES,
    RELIABILITY_DEFAULTS,
    reliabilityRequestOptionsFromInputs,
    hasCriticalTemp,
    UNPROTECTED_CRITICAL_TEMP_REQUIRED,
    wallLengths,
} from '../../utils/teqReliabilityConstants'
import { TIME_EQ_INPUT_DEFAULTS, resolveTimeEqInputs } from '../../store/timeEqPersistence'
import {
    sendTimeEqReliabilityChartsData,
    saveProjectToServer,
    downloadReliabilityCharts,
    downloadStructuralFireReport,
} from '../ApiCalls'
import { findOriginPixels, returnFinalCoordinates } from '../../utils/pointManipulation'
import CompartmentMiniMap from './CompartmentMiniMap'

export default function TimeEqWorkspace({
    project,
    floorDetail,
    selectedMacsRun,
    onProjectUpdated,
}) {
    const projectId = project?.id
    const projectName = project?.name || 'Untitled Project'

    // Seed inputs from project settings or defaults
    const [inputs, setInputs] = useState(() => {
        const saved = project?.settings?.timeEqInputs || {}
        return resolveTimeEqInputs(saved)
    })

    // Seed result and charts from project settings
    const [result, setResult] = useState(() => project?.settings?.timeEqResult || null)
    const [chartsData, setChartsData] = useState(() => project?.settings?.timeEqResult?.charts || null)
    const [isCalculating, setIsCalculating] = useState(false)
    const [isFetchingCharts, setIsFetchingCharts] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)
    const [saveNotice, setSaveNotice] = useState(null)
    const [activeModalChart, setActiveModalChart] = useState(null)
    const [isDownloadingReport, setIsDownloadingReport] = useState(false)

    const handleDownloadReport = async () => {
        if (!projectId) {
            alert('Please select or create a project first.')
            return
        }
        setIsDownloadingReport(true)
        try {
            await downloadStructuralFireReport(projectId, projectName)
        } catch (err) {
            alert(`Failed to download report: ${err.message}`)
        } finally {
            setIsDownloadingReport(false)
        }
    }

    // Keep inputs and result in sync if project changes
    useEffect(() => {
        if (project?.settings?.timeEqInputs) {
            setInputs(resolveTimeEqInputs(project.settings.timeEqInputs))
        }
        if (project?.settings?.timeEqResult) {
            setResult(project.settings.timeEqResult)
            if (project.settings.timeEqResult.charts) {
                setChartsData(project.settings.timeEqResult.charts)
            }
        }
    }, [project?.id])

    // Update field helper
    const updateField = (field, value) => {
        setInputs((prev) => ({ ...prev, [field]: value }))
    }

    // Sync from selected MACS run
    const handleSyncFromMacs = () => {
        if (!selectedMacsRun) return
        const criticalTemp = selectedMacsRun.critical_temp !== undefined
            ? selectedMacsRun.critical_temp
            : selectedMacsRun.outputs?.side_b_critical_temp || 550
        const sectionFactor = selectedMacsRun.section_factor || 140
        const section = selectedMacsRun.section || selectedMacsRun.inputs?.u_sec_size || 'UB 457x191x82'
        const exposure = selectedMacsRun.exposure || '3-sided'

        setInputs((prev) => ({
            ...prev,
            criticalTemp: Math.round(criticalTemp),
            sectionFactor: Math.round(sectionFactor),
            section,
            exposure,
            memberProtection: 'unprotected',
            macsRunId: selectedMacsRun.id || selectedMacsRun.run_id,
        }))
    }

    // Get converted points from floorDetail if available, else standard fallback box
    const getGeometryPoints = () => {
        const elements = floorDetail?.elements || []
        const pixelsPerMesh = floorDetail?.pixels_per_mesh || 1
        const canvasDim = floorDetail?.canvas_dimensions || { width: 1000, height: 800 }
        let origin = floorDetail?.origin_pixels
        if (!origin && elements.length > 0) {
            try {
                const valid = elements.filter(el => Array.isArray(el?.points) && el.points.length > 0)
                if (valid.length > 0) origin = findOriginPixels(valid)
            } catch (_) {}
        }
        if (!origin) origin = { x: 0, y: 0 }

        if (elements.length > 0) {
            try {
                const converted = returnFinalCoordinates(pixelsPerMesh * 10, elements, origin, canvasDim.height)
                if (converted && converted.length > 0) {
                    return converted.map((el, i) => ({ ...el, id: typeof el.element_index === "number" ? el.element_index : i }))
                }
            } catch (_) {}
        }

        // Standard default rectangular room: 10m x 6m with a window
        return [
            {
                id: 0,
                comments: 'obstruction',
                finalPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 6 },
                    { x: 0, y: 6 },
                    { x: 0, y: 0 },
                ],
            },
            {
                id: 1,
                comments: 'opening',
                finalPoints: [
                    { x: 2, y: 0 },
                    { x: 6, y: 0 },
                ],
            },
        ]
    }

    // Build complete request options with geometry parity guards
    const buildRequestOptions = (geoPoints) => {
        const reqOptions = reliabilityRequestOptionsFromInputs(inputs)
        const walls = wallLengths(geoPoints)
        if (reqOptions.openableWidths && reqOptions.openableWidths.length !== walls.length) {
            reqOptions.openableWidths = null
        }
        if (!reqOptions.bValue) {
            reqOptions.bValue = inputs.customBValue ? Number(inputs.customBValue) : (inputs.boundaryInertia === 'brick' ? 1675 : 1742)
        }
        if (inputs.openingHeights && inputs.openingHeights.length > 0) {
            reqOptions.openingHeights = inputs.openingHeights.map(Number)
        }
        return reqOptions
    }

    // If an existing project has a saved result with a seed but no charts saved yet,
    // automatically generate the charts using that seed and save them to the project database.
    useEffect(() => {
        // Wait until floorDetail geometry is loaded if project has floors
        if (project?.floors?.length > 0 && !floorDetail) return

        const hasSeed = result?.seed !== undefined
        const hasCharts = Boolean(result?.charts?.steelTempSpaghetti || chartsData?.steelTempSpaghetti)
        if (hasSeed && !hasCharts && !isCalculating && !isFetchingCharts) {
            let isCancelled = false
            const fetchAndSaveCharts = async () => {
                setIsFetchingCharts(true)
                try {
                    const geoPoints = getGeometryPoints()
                    const reqOptions = buildRequestOptions(geoPoints)
                    const fullRes = await sendTimeEqReliabilityChartsData(geoPoints, {
                        ...reqOptions,
                        seed: result.seed,
                    })
                    if (isCancelled) return
                    if (fullRes?.charts) {
                        setChartsData(fullRes.charts)
                        const merged = { ...result, ...fullRes, charts: fullRes.charts }
                        setResult(merged)
                        if (projectId) {
                            const payload = {
                                name: projectName,
                                settings: {
                                    ...(project?.settings || {}),
                                    timeEqInputs: inputs,
                                    timeEqResult: merged,
                                },
                                floors: floorDetail ? [floorDetail] : [],
                            }
                            const updated = await saveProjectToServer(projectId, payload)
                            if (onProjectUpdated) onProjectUpdated(updated)
                        }
                    }
                } catch (e) {
                    console.warn('Could not auto-fetch charts for existing run:', e)
                } finally {
                    if (!isCancelled) setIsFetchingCharts(false)
                }
            }
            fetchAndSaveCharts()
            return () => { isCancelled = true }
        }
    }, [result?.seed, result?.charts, projectId, floorDetail])

    // Recalculate Time Equivalence (computes Monte Carlo AND report charts, then auto-saves)
    const handleRecalculate = async () => {
        setErrorMessage(null)
        setSaveNotice(null)

        const isUnprotected = inputs.memberProtection === 'unprotected'
        if (isUnprotected && !hasCriticalTemp(inputs.criticalTemp)) {
            setErrorMessage(UNPROTECTED_CRITICAL_TEMP_REQUIRED)
            return
        }

        setIsCalculating(true)
        try {
            const geoPoints = getGeometryPoints()
            const reqOptions = buildRequestOptions(geoPoints)

            // Single request that runs Monte Carlo AND generates the charts
            const fullRes = await sendTimeEqReliabilityChartsData(geoPoints, {
                ...reqOptions,
                seed: null, // new fresh run
                includeSamples: false,
            })

            setResult(fullRes)
            const charts = fullRes?.charts || {}
            setChartsData(charts)

            // Immediately auto-save the results and charts to the project database
            if (projectId) {
                try {
                    const payload = {
                        name: projectName,
                        settings: {
                            ...(project?.settings || {}),
                            timeEqInputs: inputs,
                            timeEqResult: fullRes,
                        },
                        floors: floorDetail ? [floorDetail] : [],
                    }
                    const updated = await saveProjectToServer(projectId, payload)
                    if (onProjectUpdated) onProjectUpdated(updated)
                    setSaveNotice('Results and charts computed and saved to project.')
                    setTimeout(() => setSaveNotice(null), 4000)
                } catch (saveErr) {
                    console.warn('Auto-save of calculation results failed:', saveErr)
                }
            }
        } catch (err) {
            setErrorMessage(err.message || 'Calculation failed')
        } finally {
            setIsCalculating(false)
        }
    }

    // Save inputs & result to project
    const handleSave = async () => {
        if (!projectId) return
        setIsSaving(true)
        setSaveNotice(null)
        try {
            const resultToSave = result
                ? { ...result, charts: chartsData || result.charts || null }
                : null
            const payload = {
                name: projectName,
                settings: {
                    ...(project?.settings || {}),
                    timeEqInputs: inputs,
                    timeEqResult: resultToSave,
                },
                floors: floorDetail ? [floorDetail] : [],
            }
            const updated = await saveProjectToServer(projectId, payload)
            if (onProjectUpdated) onProjectUpdated(updated)
            setSaveNotice('Project saved successfully.')
            setTimeout(() => setSaveNotice(null), 3000)
        } catch (err) {
            setErrorMessage(err.message || 'Failed to save project')
        } finally {
            setIsSaving(false)
        }
    }

    // Deep-link to Canvas for geometry edits
    const handleOpenCanvas = () => {
        if (!projectId) return
        window.location.href = `/?project=${encodeURIComponent(projectId)}&returnTo=structural-fire`
    }

    const failureProb = result?.failure_prob !== undefined
        ? result.failure_prob
        : (result?.nFailed !== undefined && result?.nSim)
        ? (result.nFailed / result.nSim)
        : (result?.reliability !== undefined ? (1 - result.reliability) : null)

    const isSafe = failureProb !== null ? failureProb <= 0.05 : null

    const hasDrawnElements = (floorDetail?.elements || []).length > 0

    const isUnprotected = inputs.memberProtection === 'unprotected' || result?.unprotected

    return (
        <div className="space-y-4">
            {/* Project Navigation & Geometry Header */}
            <div id="linked-project-minimap-card" className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm scroll-mt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-bold text-gray-500 tracking-wider">Linked Project</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                timeEq
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mt-0.5">{projectName}</h2>
                        <span className="text-xs text-gray-500 block">
                            {hasDrawnElements
                                ? `${floorDetail.elements.length} compartment elements drawn on plan`
                                : 'No compartment drawn yet (using standard reference room)'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleOpenCanvas}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm transition-colors flex items-center gap-1.5"
                        >
                            <span>📐</span>
                            <span>Edit Geometry on Canvas</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            <span>💾</span>
                            <span>{isSaving ? 'Saving…' : 'Save'}</span>
                        </button>
                    </div>
                </div>

                {/* Interactive Compartment Mini-Map & Boundary Assignments (Option 1) */}
                <CompartmentMiniMap
                    geoPoints={getGeometryPoints()}
                    inputs={inputs}
                    onInputsChange={updateField}
                    selectedMacsRun={selectedMacsRun}
                    onOpenCanvas={handleOpenCanvas}
                />
            </div>

            {/* Error or Notice messages */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button type="button" onClick={() => setErrorMessage(null)} className="font-bold text-rose-600 hover:text-black ml-2">×</button>
                </div>
            )}
            {saveNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                    <span>✓</span>
                    <span>{saveNotice}</span>
                </div>
            )}

            {/* Reliability Results Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <span>Time Equivalence & Reliability Results</span>
                        {result && failureProb !== null && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                isSafe
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}>
                                {isSafe ? 'SAFE (Pf ≤ 5%)' : 'EXCEEDS THRESHOLD (Pf > 5%)'}
                            </span>
                        )}
                    </h3>

                    <button
                        type="button"
                        onClick={handleRecalculate}
                        disabled={isCalculating}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <span>⚡</span>
                        <span>{isCalculating ? 'Computing Monte Carlo…' : 'Recalculate Time Eq'}</span>
                    </button>
                </div>

                {result ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-gray-500 block">Failure Probability (Pf)</span>
                            <span className={`text-2xl font-black tabular-nums ${
                                isSafe ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                                {failureProb !== null ? `${(failureProb * 100).toFixed(2)} %` : '-'}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                {result.nFailed !== undefined && result.nSim !== undefined ? `${result.nFailed} of ${result.nSim} fires exceeded limit` : 'Target: Pf ≤ 5%'}
                            </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-gray-500 block">Reliability (% or β)</span>
                            <span className="text-2xl font-black text-slate-800 tabular-nums">
                                {result.reliabilityPercent !== undefined ? `${result.reliabilityPercent.toFixed(1)}%` : result.beta !== undefined ? `β = ${result.beta.toFixed(2)}` : '-'}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                {result.seed !== undefined ? `Run seed: ${result.seed}` : 'Structural fire reliability'}
                            </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-gray-500 block">
                                {isUnprotected ? 'Critical Temp Limit' : 'Equivalent Time (te,d)'}
                            </span>
                            <span className="text-2xl font-black text-blue-700 tabular-nums">
                                {isUnprotected
                                    ? `${result.criticalTemp || inputs.criticalTemp || 550} °C`
                                    : (result.fractile_equiv_time !== undefined
                                        ? `${result.fractile_equiv_time.toFixed(1)} min`
                                        : result.mean_equiv_time !== undefined
                                        ? `${result.mean_equiv_time.toFixed(1)} min`
                                        : result.frPeriod !== undefined
                                        ? `${result.frPeriod} min`
                                        : '-')}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                {isUnprotected ? 'Unprotected member failure limit' : 'Equivalent fire exposure'}
                            </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-gray-500 block">
                                {isUnprotected ? 'Protection Mode' : 'Fire Resistance Rating (R)'}
                            </span>
                            <span className="text-2xl font-black text-purple-700 tabular-nums">
                                {isUnprotected ? 'Unprotected' : (inputs.fireResistancePeriod ? `${inputs.fireResistancePeriod} min` : '-')}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                {isUnprotected ? 'Governed by MACS Critical Temp' : 'Design standard fire rating'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-xs text-gray-500 italic bg-gray-50 rounded-lg border border-gray-100">
                        No calculation results saved yet. Click &quot;Recalculate Time Eq&quot; to run a Monte Carlo study.
                    </div>
                )}

                {/* Monte Carlo Reliability Charts */}
                {isFetchingCharts && !chartsData && (
                    <div className="mt-4 p-5 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-center gap-3 text-xs text-blue-700">
                        <span className="animate-spin text-base">⏳</span>
                        <span>Generating report charts for saved run (seed {result?.seed})…</span>
                    </div>
                )}

                {chartsData && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                    Monte Carlo Reliability Charts
                                </h4>
                                {result?.nSim && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                        N = {result.nSim} fires
                                    </span>
                                )}
                                {result?.seed !== undefined && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                        Seed: {result.seed}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownloadReport}
                                    disabled={isDownloadingReport}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    title="Download combined structural fire engineering report (.docx)"
                                >
                                    <span>📄</span>
                                    <span>{isDownloadingReport ? 'Downloading…' : 'Download Report (.docx)'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => downloadReliabilityCharts(chartsData, result?.seed)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
                                    title="Download both charts as PNG files"
                                >
                                    <span>📥</span>
                                    <span>Download Charts (PNG)</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {chartsData.steelTempSpaghetti && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <span className="text-xs font-bold text-gray-800 block">
                                                Steel Temperature vs Fire Exposure Time
                                            </span>
                                            <span className="text-[11px] text-gray-500">
                                                Heating curves against critical temperature limit ({result?.criticalTemp || inputs.criticalTemp || 550}°C)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveModalChart({
                                                title: 'Steel Temperature vs Fire Duration',
                                                src: `data:image/png;base64,${chartsData.steelTempSpaghetti}`,
                                            })}
                                            className="text-gray-400 hover:text-gray-700 text-xs p-1 rounded hover:bg-gray-100"
                                            title="Enlarge"
                                        >
                                            🔍
                                        </button>
                                    </div>
                                    <div
                                        className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-gray-100 flex-1 flex items-center justify-center p-1"
                                        onClick={() => setActiveModalChart({
                                            title: 'Steel Temperature vs Fire Duration',
                                            src: `data:image/png;base64,${chartsData.steelTempSpaghetti}`,
                                        })}
                                    >
                                        <img
                                            src={`data:image/png;base64,${chartsData.steelTempSpaghetti}`}
                                            alt="Steel Temperature Spaghetti"
                                            className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                        />
                                    </div>
                                </div>
                            )}

                            {chartsData.passFailScatter && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div>
                                            <span className="text-xs font-bold text-gray-800 block">
                                                Pass / Fail Parametric Scatter
                                            </span>
                                            <span className="text-[11px] text-gray-500">
                                                Compartment fuel load density (MJ/m²) vs ventilation opening factor
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveModalChart({
                                                title: 'Pass / Fail Parametric Scatter',
                                                src: `data:image/png;base64,${chartsData.passFailScatter}`,
                                            })}
                                            className="text-gray-400 hover:text-gray-700 text-xs p-1 rounded hover:bg-gray-100"
                                            title="Enlarge"
                                        >
                                            🔍
                                        </button>
                                    </div>
                                    <div
                                        className="cursor-pointer overflow-hidden rounded bg-slate-50 border border-gray-100 flex-1 flex items-center justify-center p-1"
                                        onClick={() => setActiveModalChart({
                                            title: 'Pass / Fail Parametric Scatter',
                                            src: `data:image/png;base64,${chartsData.passFailScatter}`,
                                        })}
                                    >
                                        <img
                                            src={`data:image/png;base64,${chartsData.passFailScatter}`}
                                            alt="Pass Fail Scatter"
                                            className="w-full h-auto object-contain hover:scale-[1.01] transition-transform rounded"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

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

            {/* In-Place Parameters Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <h3 className="text-sm font-bold text-gray-800">In-Place Parameters Editor</h3>
                    {selectedMacsRun && (
                        <button
                            type="button"
                            onClick={handleSyncFromMacs}
                            className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors"
                        >
                            Sync Critical Temp ({Math.round(selectedMacsRun.critical_temp)}°C) from selected run
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Column 1: Occupancy & Resistance */}
                    <div className="space-y-3">
                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Occupancy / Fuel Load</label>
                            <select
                                value={inputs.mcOccupancy || 'Office'}
                                onChange={(e) => updateField('mcOccupancy', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500"
                            >
                                {OCCUPANCY_DISTRIBUTIONS.map((occ) => (
                                    <option key={occ.occupancy} value={occ.occupancy}>
                                        {occ.occupancy} ({occ.mean} MJ/m²)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Fire Resistance Period (R)</label>
                            <select
                                value={inputs.fireResistancePeriod || 60}
                                onChange={(e) => updateField('fireResistancePeriod', Number(e.target.value))}
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500"
                            >
                                <option value={30}>30 minutes</option>
                                <option value={60}>60 minutes</option>
                                <option value={90}>90 minutes</option>
                                <option value={120}>120 minutes</option>
                                <option value={240}>240 minutes</option>
                            </select>
                        </div>

                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Compartment Height (m)</label>
                            <input
                                type="number"
                                step="0.05"
                                min="1"
                                max="20"
                                value={inputs.compartmentHeight || 3.15}
                                onChange={(e) => updateField('compartmentHeight', Number(e.target.value))}
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="isSprinklered"
                                checked={Boolean(inputs.isSprinklered)}
                                onChange={(e) => updateField('isSprinklered', e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isSprinklered" className="font-medium text-gray-700 cursor-pointer">
                                Sprinklered Protection (Factor: {inputs.sprinklerFactor || 0.65})
                            </label>
                        </div>
                    </div>

                    {/* Column 2: Steel Member & MACS Linking */}
                    <div className="space-y-3">
                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Member Protection Mode</label>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="memberProtection"
                                        value="unprotected"
                                        checked={inputs.memberProtection === 'unprotected'}
                                        onChange={() => updateField('memberProtection', 'unprotected')}
                                    />
                                    <span>Unprotected (MACS)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="memberProtection"
                                        value="protected"
                                        checked={inputs.memberProtection !== 'unprotected'}
                                        onChange={() => updateField('memberProtection', 'protected')}
                                    />
                                    <span>Protected</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Steel Section</label>
                            <input
                                type="text"
                                value={inputs.section || ''}
                                onChange={(e) => updateField('section', e.target.value)}
                                placeholder="e.g. UB 457x191x82"
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="font-semibold text-gray-700 block mb-1">Critical Temp (°C)</label>
                                <input
                                    type="number"
                                    value={inputs.criticalTemp || 550}
                                    onChange={(e) => updateField('criticalTemp', Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800 font-bold text-blue-900"
                                />
                            </div>
                            <div>
                                <label className="font-semibold text-gray-700 block mb-1">Ap/V (m⁻¹)</label>
                                <input
                                    type="number"
                                    value={inputs.sectionFactor || 140}
                                    onChange={(e) => updateField('sectionFactor', Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Exposure</label>
                            <select
                                value={inputs.exposure || '3-sided'}
                                onChange={(e) => updateField('exposure', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                            >
                                <option value="3-sided">3-sided (Composite slab above)</option>
                                <option value="4-sided">4-sided (Isolated)</option>
                            </select>
                        </div>
                    </div>

                    {/* Column 3: Monte Carlo & Boundaries */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="font-semibold text-gray-700 block mb-1">Simulations (N)</label>
                                <input
                                    type="number"
                                    step="500"
                                    min="500"
                                    max="10000"
                                    value={inputs.nSim || RELIABILITY_DEFAULTS.nSim}
                                    onChange={(e) => updateField('nSim', Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="font-semibold text-gray-700 block mb-1">Growth Rate</label>
                                <select
                                    value={inputs.growthRate || 'Medium'}
                                    onChange={(e) => updateField('growthRate', e.target.value)}
                                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                                >
                                    {GROWTH_RATES.map((g) => (
                                        <option key={g.label} value={g.label}>{g.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="font-semibold text-gray-700 block mb-1">Combustion Factor</label>
                            <input
                                type="number"
                                step="0.05"
                                min="0.1"
                                max="1.0"
                                value={inputs.combustionFactor || 0.8}
                                onChange={(e) => updateField('combustionFactor', Number(e.target.value))}
                                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-800"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="font-semibold text-gray-700">Boundary Thermal Inertia (b)</label>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('linked-project-minimap-card')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
                                >
                                    <span>↑</span> View on Plan
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={inputs.customBValue ? `Custom (b = ${inputs.customBValue})` : 'Derived from Plan & Wall Table'}
                                    readOnly
                                    onClick={() => document.getElementById('linked-project-minimap-card')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-gray-50 text-gray-700 font-medium text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                                    title="Click to view and edit wall materials and openings on the plan above"
                                />
                                {inputs.customBValue && (
                                    <button
                                        type="button"
                                        onClick={() => updateField('customBValue', '')}
                                        className="text-[10px] text-blue-600 hover:underline flex-shrink-0 font-semibold"
                                        title="Reset to derived wall properties"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                                    
                    </div>
                </div>
            </div>
        </div>
    )
}
