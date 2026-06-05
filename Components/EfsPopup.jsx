import { useState, useEffect, useMemo } from 'react'
import useStore from '../store/useStore'
import {
    assessElevationBays,
    suggestProtection,
    celsiusToKelvin,
    polylineLength,
    projectSpanOntoWall,
    baysCoveredBySpan,
    splitIntoElevations,
    pointToPolylineDistance,
    bre135ElevationsFromWall,
} from '../utils/efsViewFactor'
import { calculateEfs, downloadEfsReport } from './ApiCalls'

// EFS (External Fire Spread) inputs + result popup. Two methods live behind
// top-level tabs:
//   1. "View factor (BR 187)" — the in-browser configuration-factor assessment.
//      The engineer draws ONE outline around the whole building plus the relevant
//      boundary. Issue #10: that outline is split into its ELEVATIONS (faces) at
//      the real corners; each elevation gets its own tab and is assessed
//      independently against the shared boundary (the full outline is used for
//      line-of-sight so a face's normal can't measure through the building). Per
//      elevation: lay column bays, goal-seek the required boundary distance at
//      each bay's worst point vs the actual (perpendicular) distance. Issue #8:
//      bays can be PROTECTED (removed from the emitter) by hand or via "Suggest
//      protection". Issue #11: PROTECTED / UNPROTECTED region polylines snap to
//      bays and carry a vertical band (sill→head).
//   2. "Enclosing rectangle (BRE 135)" — a frontend for the existing tabular
//      backend (backendForNextApp routers/efs.py). Elevations come from the same
//      splitIntoElevations faces; the engineer sets per-elevation boundary
//      distance (seeded from the drawing), a global height + suppression toggle
//      and a commercial/residential toggle, and we POST to /efs/calculate.
// See utils/efsViewFactor.js.
const EfsPopup = ({ onClose }) => {
    const convertedPoints = useStore((state) => state.convertedPoints)

    const [activeTab, setActiveTab] = useState('viewFactor')

    // Inputs live in the store so they (and the result, re-run below) survive
    // closing and reopening the popup.
    const height = useStore((state) => state.efsHeight)
    const setHeight = useStore((state) => state.setEfsHeight)
    const fireTempC = useStore((state) => state.efsFireTempC)
    const setFireTempC = useStore((state) => state.setEfsFireTempC)
    const columnSpacing = useStore((state) => state.efsColumnSpacing)
    const setColumnSpacing = useStore((state) => state.setEfsColumnSpacing)
    const setEfsCalcDone = useStore((state) => state.setEfsCalcDone)
    const efsCalcDone = useStore((state) => state.efsCalcDone)
    // Active elevation + per-elevation protected bays (issues #8/#10).
    const activeElev = useStore((state) => state.efsActiveElevation)
    const setActiveElev = useStore((state) => state.setEfsActiveElevation)
    const protectedByElev = useStore((state) => state.efsProtectedByElev)
    const setProtectedForElev = useStore((state) => state.setEfsProtectedForElev)
    const toggleProtectedForElev = useStore((state) => state.toggleEfsProtectedForElev)
    const setRequiredForElev = useStore((state) => state.setEfsRequiredForElev)
    const cornersFirst = useStore((state) => state.efsCornersFirst)
    const setCornersFirst = useStore((state) => state.setEfsCornersFirst)
    // Optional custom end-bay spacing per elevation (tick boxes).
    const endSpacingByElev = useStore((state) => state.efsEndSpacingByElev)
    const setEndSpacingForElev = useStore((state) => state.setEfsEndSpacingForElev)
    // Region bands (issue #11), keyed by drawn region element id.
    const regionConfig = useStore((state) => state.efsRegionConfig)
    const setRegionBand = useStore((state) => state.setEfsRegionBand)

    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [suggestNote, setSuggestNote] = useState(null)

    // ---- Enclosing rectangle (BRE 135) tab state ----
    // Elevations come from the same faces as the view-factor method
    // (splitIntoElevations); each carries its width and a boundary distance
    // seeded from the closest approach to the drawn boundary (editable). Height,
    // suppression and building type are global to the BRE 135 run.
    const derivedElevations = useMemo(() => {
        const w = (convertedPoints || []).find((el) => el.comments === 'efsWall')
        const b = (convertedPoints || []).find((el) => el.comments === 'efsBoundary')
        if (!w || !w.finalPoints) return []
        return bre135ElevationsFromWall(w.finalPoints, b ? b.finalPoints : [])
    }, [convertedPoints])

    const [isCommercial, setIsCommercial] = useState(true)
    const [breHeight, setBreHeight] = useState(18)
    const [breSuppression, setBreSuppression] = useState(false)
    const [bdInputs, setBdInputs] = useState([])
    const [breResult, setBreResult] = useState(null)
    const [breError, setBreError] = useState(null)
    const [breLoading, setBreLoading] = useState(false)
    const [reportLoading, setReportLoading] = useState(false)

    // Re-seed the editable boundary distances whenever the derived elevations change.
    useEffect(() => {
        setBdInputs(
            derivedElevations.map((e) =>
                e.boundaryDistance == null ? '' : String(Math.round(e.boundaryDistance * 10) / 10),
            ),
        )
    }, [derivedElevations])

    // Elevations are derived from the drawn wall outline (split at corners).
    const wall = (convertedPoints || []).find((el) => el.comments === 'efsWall')
    const elevations = wall?.finalPoints?.length >= 2 ? splitIntoElevations(wall.finalPoints) : []
    const active = elevations.length ? Math.min(activeElev, elevations.length - 1) : 0
    const protectedBays = protectedByElev[active] || []

    // Resolve the active elevation's custom end-bay spacing into calc opts.
    const endCfg = endSpacingByElev[active] || {}
    const endOpts = (cfg) => ({
        firstSpacing: cfg.firstEnabled && cfg.firstSpacing > 0 ? Number(cfg.firstSpacing) : undefined,
        lastSpacing: cfg.lastEnabled && cfg.lastSpacing > 0 ? Number(cfg.lastSpacing) : undefined,
    })

    function readInputs() {
        if (!wall || !wall.finalPoints || wall.finalPoints.length < 2) {
            setError('No wall line found — draw the building outline first.')
            return null
        }
        const boundary = (convertedPoints || []).find((el) => el.comments === 'efsBoundary')
        const h = Number(height)
        const sp = Number(columnSpacing)
        if (!(h > 0) || !(sp > 0)) {
            setError('Height and column spacing must be positive.')
            return null
        }
        setError(null)
        return { boundary, h, sp, T: celsiusToKelvin(Number(fireTempC)) }
    }

    // Drawn region polylines, bound to the nearest elevation, snapped to the bays
    // they cover on that face, with their configured vertical band — for `face`.
    function regionsForFace(face, faceWidth, spacing, h, opts) {
        const regs = []
        for (const el of (convertedPoints || [])) {
            if (el.comments !== 'efsProtected' && el.comments !== 'efsUnprotected') continue
            if (!el.finalPoints || !el.finalPoints.length) continue
            const mid = el.finalPoints.reduce(
                (acc, p) => ({ x: acc.x + p.x / el.finalPoints.length, y: acc.y + p.y / el.finalPoints.length }),
                { x: 0, y: 0 },
            )
            let bestIdx = 0
            let bestD = Infinity
            elevations.forEach((e, idx) => {
                const d = pointToPolylineDistance(mid, e.points)
                if (d < bestD) { bestD = d; bestIdx = idx }
            })
            if (elevations[bestIdx] !== face) continue
            const { start, end } = projectSpanOntoWall(face.points, el.finalPoints)
            const bays = baysCoveredBySpan(faceWidth, spacing, start, end, opts || {})
            if (!bays.length) continue
            const cfg = regionConfig[el.id] || {}
            regs.push({
                id: el.id,
                kind: el.comments === 'efsProtected' ? 'protected' : 'unprotected',
                bays,
                base: cfg.base == null ? 0 : Math.max(0, Math.min(h, cfg.base)),
                top: cfg.top == null ? h : Math.max(0, Math.min(h, cfg.top)),
            })
        }
        return regs
    }

    // Assess elevation `idx` with a given protected-bay set; store the result.
    function assessElev(idx, bays) {
        const inp = readInputs()
        if (!inp) return null
        const face = elevations[idx]
        if (!face) { setError('No elevation at that tab.'); return null }
        const faceWidth = polylineLength(face.points)
        const opts = endOpts(endSpacingByElev[idx] || {})
        const regions = regionsForFace(face, faceWidth, inp.sp, inp.h, opts)
        const res = assessElevationBays({
            wallPoints: face.points,
            boundaryPoints: inp.boundary ? inp.boundary.finalPoints : [],
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            protectedBays: bays,
            regions,
            firstSpacing: opts.firstSpacing,
            lastSpacing: opts.lastSpacing,
            buildingPoints: wall.finalPoints,
        })
        res._regions = regions
        res._elevIndex = idx
        res._elevCount = elevations.length
        setResult(res)
        setRequiredForElev(idx, res.requiredByStation)
        setEfsCalcDone(true)
        return res
    }

    function handleRun() {
        setSuggestNote(null)
        assessElev(active, protectedBays)
    }

    // The result table is local state, so it's lost when the popup unmounts on
    // close. If a calc was already run, recompute it on reopen so the popup comes
    // back with its results (inputs already persist via the store). Mount-only.
    useEffect(() => {
        if (efsCalcDone && wall?.finalPoints?.length >= 2) {
            assessElev(active, protectedBays)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function switchTab(i) {
        setActiveElev(i)
        setSuggestNote(null)
        assessElev(i, protectedByElev[i] || [])
    }

    function handleToggleBay(bay) {
        const next = protectedBays.includes(bay)
            ? protectedBays.filter((b) => b !== bay)
            : [...protectedBays, bay]
        toggleProtectedForElev(active, bay)
        setSuggestNote(null)
        assessElev(active, next)
    }

    function handleSuggest() {
        const inp = readInputs()
        if (!inp) return
        if (!inp.boundary) {
            setError('Draw a Boundary polyline before suggesting protection.')
            return
        }
        const face = elevations[active]
        const faceWidth = polylineLength(face.points)
        const opts = endOpts(endCfg)
        const regions = regionsForFace(face, faceWidth, inp.sp, inp.h, opts)
        const sug = suggestProtection({
            wallPoints: face.points,
            boundaryPoints: inp.boundary.finalPoints,
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            cornersFirst,
            regions,
            firstSpacing: opts.firstSpacing,
            lastSpacing: opts.lastSpacing,
            buildingPoints: wall.finalPoints,
        })
        setProtectedForElev(active, sug.protectedBays)
        sug.assessment._regions = regions
        sug.assessment._elevIndex = active
        sug.assessment._elevCount = elevations.length
        setResult(sug.assessment)
        setRequiredForElev(active, sug.assessment.requiredByStation)
        setEfsCalcDone(true)
        if (sug.achievable) {
            const n = sug.protectedBays.length
            setSuggestNote(n === 0
                ? 'Already compliant — no protection needed.'
                : `Protected ${n} bay${n === 1 ? '' : 's'} (${sug.protectedBays.join(', ')}) on this elevation.`)
        } else {
            setSuggestNote('Compliance not achievable by protecting bays alone (an unprotected constraint may govern).')
        }
    }

    function handleClearProtection() {
        setProtectedForElev(active, [])
        setSuggestNote(null)
        assessElev(active, [])
    }

    // Custom end-bay spacing for the active elevation. Re-laying the bays
    // invalidates the protected-bay indices, so clear them and re-assess.
    function updateEndSpacing(patch) {
        setEndSpacingForElev(active, patch)
        setProtectedForElev(active, [])
        setSuggestNote(null)
        setTimeout(() => assessElev(active, []), 0)
    }

    function updateRegionBand(id, patch) {
        const h = Number(height)
        const clamp = (v) => Math.max(0, Math.min(h, Number(v)))
        const next = {}
        if (patch.base != null) next.base = clamp(patch.base)
        if (patch.top != null) next.top = clamp(patch.top)
        setRegionBand(id, next)
        setSuggestNote(null)
        setTimeout(() => assessElev(active, protectedBays), 0)
    }

    const updateBd = (idx, value) => {
        setBdInputs((rows) => rows.map((r, i) => (i === idx ? value : r)))
    }

    const buildBrePayload = () => {
        const payload = derivedElevations.map((e, i) => {
            const raw = (bdInputs[i] ?? '').trim()
            return {
                boundary_distance: raw === '' ? NaN : Number(raw),
                width: e.width,
                height: Number(breHeight),
                has_suppression: breSuppression,
            }
        })
        const bad =
            payload.length === 0 ||
            !(Number(breHeight) > 0) ||
            payload.some((e) => !Number.isFinite(e.boundary_distance) || !(e.width > 0))
        return { payload, bad }
    }

    async function handleBreCalc() {
        const { payload, bad } = buildBrePayload()
        if (bad) {
            setBreError('Draw a wall polyline, set a positive elevation height, and give each elevation a boundary distance.')
            return
        }
        setBreError(null)
        setBreLoading(true)
        try {
            const res = await calculateEfs(payload, isCommercial)
            setBreResult(res)
            setEfsCalcDone(true)
        } catch (err) {
            setBreError(err.message || 'Calculation failed.')
        } finally {
            setBreLoading(false)
        }
    }

    async function handleBreReport() {
        const { payload, bad } = buildBrePayload()
        if (bad) {
            setBreError('Draw a wall polyline, set a positive elevation height, and give each elevation a boundary distance.')
            return
        }
        setBreError(null)
        setReportLoading(true)
        try {
            await downloadEfsReport(payload, isCommercial)
        } catch (err) {
            setBreError(err.message || 'Failed to generate report.')
        } finally {
            setReportLoading(false)
        }
    }

    const tabClass = (key) =>
        `px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
        }`

    const BRE_HEADERS = [
        'Elevation', 'Boundary Dist (m)', 'ER Width (m)', 'ER Height (m)',
        'BRE Width (m)', 'BRE Height (m)', 'BRE % Unprotected', 'Allowable Area (m²)',
        'Actual Area (m²)', 'Actual Allowable Area (m²)', 'Actual % Unprotected',
    ]
    const breRowCells = (r) => [
        r.elevation_number, r.boundary_distance, r.er_width, r.er_height,
        r.bre_width, r.bre_height, r.bre_percentage, r.allowable_area,
        r.actual_area, r.actual_protected_area, r.actual_percentage,
    ]

    const numberField = (label, value, setter) => (
        <label className="block mb-3">
            <span className="block text-sm font-medium mb-1">{label}</span>
            <input
                type="number"
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 rounded-md"
            />
        </label>
    )

    const statusLabel = (r) => {
        switch (r.status) {
            case 'protected': return 'Protected'
            case 'partially-protected': return 'Part-protected'
            case 'unprotected': return 'Unprotected'
            case 'mixed': return 'Mixed'
            case 'conflict': return 'CONFLICT'
            default: return r.pass == null ? '—' : (r.pass ? 'OK' : 'FAIL')
        }
    }

    const regions = (result && result._elevIndex === active) ? (result._regions || []) : []
    const showResult = result && result._elevIndex === active

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={() => onClose && onClose()}
        >
            <div
                className="relative bg-white p-5 rounded-lg shadow-lg text-black w-full max-w-4xl max-h-[85vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="Close"
                    className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl leading-none"
                    onClick={() => onClose && onClose()}
                >
                    &times;
                </button>
                <h2 className="text-lg font-bold mb-3">External Fire Spread</h2>

                <div className="flex border-b mb-4">
                    <button type="button" className={tabClass('viewFactor')} onClick={() => setActiveTab('viewFactor')}>
                        View factor (BR 187)
                    </button>
                    <button type="button" className={tabClass('bre135')} onClick={() => setActiveTab('bre135')}>
                        Enclosing rectangle (BRE 135)
                    </button>
                </div>

                {activeTab === 'viewFactor' && (
                <>
                {numberField('Elevation height (m)', height, setHeight)}
                {numberField('Fire temperature (°C)', fireTempC, setFireTempC)}
                {numberField('Column spacing (m)', columnSpacing, setColumnSpacing)}

                {/* Custom end-bay spacing for the active elevation (tick boxes). */}
                <div className="mb-3 text-sm space-y-1">
                    <p className="text-xs text-gray-500">End bays{elevations.length > 1 ? ` (Elevation ${elevations[active]?.index})` : ''}</p>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1">
                            <input
                                type="checkbox"
                                checked={!!endCfg.firstEnabled}
                                onChange={(e) => updateEndSpacing({ firstEnabled: e.target.checked, firstSpacing: endCfg.firstSpacing ?? columnSpacing })}
                            />
                            Custom first bay
                        </label>
                        {endCfg.firstEnabled && (
                            <input
                                type="number"
                                value={endCfg.firstSpacing ?? columnSpacing}
                                onChange={(e) => updateEndSpacing({ firstSpacing: e.target.value })}
                                className="w-20 border border-gray-300 px-2 py-1 rounded"
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1">
                            <input
                                type="checkbox"
                                checked={!!endCfg.lastEnabled}
                                onChange={(e) => updateEndSpacing({ lastEnabled: e.target.checked, lastSpacing: endCfg.lastSpacing ?? columnSpacing })}
                            />
                            Custom last bay
                        </label>
                        {endCfg.lastEnabled && (
                            <input
                                type="number"
                                value={endCfg.lastSpacing ?? columnSpacing}
                                onChange={(e) => updateEndSpacing({ lastSpacing: e.target.value })}
                                className="w-20 border border-gray-300 px-2 py-1 rounded"
                            />
                        )}
                    </div>
                </div>

                <p className="text-xs text-gray-500 mb-3">Radiation threshold fixed at 12.6 kW/m² (BR 187).</p>

                {/* Elevation tabs (issue #10): one per face of the drawn outline. */}
                {elevations.length > 1 && (
                    <div className="flex flex-wrap gap-1 mb-3 border-b">
                        {elevations.map((e, i) => (
                            <button
                                key={i}
                                onClick={() => switchTab(i)}
                                className={`px-3 py-1 text-sm rounded-t ${
                                    i === active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-black hover:bg-gray-200'
                                }`}
                            >
                                Elevation {e.index}
                            </button>
                        ))}
                    </div>
                )}

                {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

                <div className="flex flex-wrap items-center gap-2">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg" onClick={handleRun}>
                        Run Calc
                    </button>
                    <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={handleSuggest}>
                        Suggest protection
                    </button>
                    {protectedBays.length > 0 && (
                        <button
                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-lg text-sm"
                            onClick={handleClearProtection}
                        >
                            Clear protection
                        </button>
                    )}
                    <label className="flex items-center gap-1 text-sm ml-1">
                        <input type="checkbox" checked={cornersFirst} onChange={(e) => setCornersFirst(e.target.checked)} />
                        Corners first
                    </label>
                </div>

                {suggestNote && <p className="text-sm mt-2 text-amber-800">{suggestNote}</p>}

                {regions.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                        <p className="text-sm font-medium mb-2">Regions on this elevation (sill → head, m)</p>
                        <div className="space-y-2">
                            {regions.map((rg) => (
                                <div key={rg.id} className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded ${rg.kind === 'protected' ? 'bg-gray-300' : 'bg-blue-200'}`}>
                                        {rg.kind === 'protected' ? 'Protected' : 'Unprotected'}
                                    </span>
                                    <span className="text-gray-600">bays {rg.bays.join(', ')}</span>
                                    <label className="flex items-center gap-1">
                                        sill
                                        <input
                                            type="number"
                                            value={rg.base}
                                            onChange={(e) => updateRegionBand(rg.id, { base: e.target.value })}
                                            className="w-16 border border-gray-300 px-1 py-0.5 rounded"
                                        />
                                    </label>
                                    <label className="flex items-center gap-1">
                                        head
                                        <input
                                            type="number"
                                            value={rg.top}
                                            onChange={(e) => updateRegionBand(rg.id, { top: e.target.value })}
                                            className="w-16 border border-gray-300 px-1 py-0.5 rounded"
                                        />
                                    </label>
                                    {rg.kind === 'protected' && !(rg.base === 0 && rg.top === Number(height)) && (
                                        <button
                                            className="px-2 py-0.5 bg-gray-700 text-white rounded"
                                            onClick={() => updateRegionBand(rg.id, { base: 0, top: Number(height) })}
                                        >
                                            Fully protect
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showResult && (
                    <div className="mt-4 border-t pt-3">
                        <p className="text-sm font-medium">
                            Elevation {elevations[active]?.index} of {result._elevCount}
                        </p>
                        <p className="text-sm">Elevation width (from wall): <b>{result.width.toFixed(2)} m</b></p>
                        <p className="text-base mt-1">
                            Governing required boundary distance:{' '}
                            <b>{result.governingRequiredBoundaryDistance.toFixed(2)} m</b>
                        </p>
                        {protectedBays.length > 0 && (
                            <p className="text-sm mt-1 text-gray-700">
                                Protected {protectedBays.length} of {result.nBays} bays: {protectedBays.join(', ')}
                            </p>
                        )}
                        {result.hasConflict && (
                            <p className="text-sm mt-1 text-red-700 font-medium">
                                Conflict on bay(s) {result.conflictBays.join(', ')}: a protected and an unprotected
                                region overlap. Neither is applied there — adjust the regions.
                            </p>
                        )}
                        {result.hasBoundary ? (
                            <p className={`text-sm mt-1 ${result.allPass ? 'text-green-700' : 'text-red-700'}`}>
                                {result.allPass
                                    ? 'All bays compliant.'
                                    : `${result.failingCount} bay(s) exceed the 12.6 kW/m² boundary criterion.`}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">
                                Draw a Boundary polyline to check actual distances.
                            </p>
                        )}
                        <div className="overflow-x-auto mt-3">
                            <table className="text-xs border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-1 pr-2">Bay</th>
                                        <th className="py-1 pr-2">Cols</th>
                                        <th className="py-1 pr-2">View factor</th>
                                        <th className="py-1 pr-2">I<sub>s</sub> (kW/m²)</th>
                                        <th className="py-1 pr-2">S (m)</th>
                                        <th className="py-1 pr-2">Required (m)</th>
                                        <th className="py-1 pr-2">Actual (m)</th>
                                        <th className="py-1 pr-2">Protect</th>
                                        <th className="py-1 pr-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((r) => (
                                        <tr
                                            key={r.bay}
                                            className={`border-b ${
                                                r.status === 'conflict' ? 'bg-red-100'
                                                    : r.protected ? 'bg-gray-100'
                                                        : r.status === 'unprotected' ? 'bg-blue-50'
                                                            : (r.pass === false ? 'bg-red-50' : '')
                                            }`}
                                        >
                                            <td className="py-1 pr-2">{r.bay}</td>
                                            <td className="py-1 pr-2">{r.leftCol}–{r.rightCol}</td>
                                            {/* A protected bay doesn't emit, so its own view factor / incident
                                                are not meaningful — blank them. The S / Required columns stay:
                                                a boundary may still be needed here from ADJACENT unprotected bays. */}
                                            <td className="py-1 pr-2">{r.protected ? '—' : r.viewFactorTotal.toFixed(5)}</td>
                                            <td className="py-1 pr-2">{r.protected ? '—' : r.incident.toFixed(2)}</td>
                                            <td className="py-1 pr-2">{r.S.toFixed(2)}</td>
                                            <td className="py-1 pr-2">{r.requiredBoundaryDistance.toFixed(2)}</td>
                                            <td className="py-1 pr-2">
                                                {r.actualBoundaryDistance == null ? '—' : r.actualBoundaryDistance.toFixed(2)}
                                            </td>
                                            <td className="py-1 pr-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Protect bay ${r.bay}`}
                                                    checked={r.protected}
                                                    onChange={() => handleToggleBay(r.bay)}
                                                />
                                            </td>
                                            <td className="py-1 pr-2">{statusLabel(r)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {result.rows.some((r) => r.protected) && (
                            <p className="text-xs text-gray-500 mt-2">
                                Protected bays don&apos;t emit (view factor / I<sub>s</sub> shown as —). A
                                Required distance can still appear against a protected bay — that is the
                                boundary needed there from radiation arriving off the adjacent
                                <em> unprotected</em> bays, not from the protected bay itself.
                            </p>
                        )}
                    </div>
                )}
                </>
                )}

                {activeTab === 'bre135' && (
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <span className="text-sm font-medium">Building type:</span>
                            <label className="flex items-center gap-1 text-sm">
                                <input type="radio" name="breBuildingType" checked={isCommercial} onChange={() => setIsCommercial(true)} />
                                Commercial
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                                <input type="radio" name="breBuildingType" checked={!isCommercial} onChange={() => setIsCommercial(false)} />
                                Residential
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 mb-3">
                            <label className="flex items-center gap-2 text-sm">
                                <span className="font-medium">Elevation height (m)</span>
                                <input
                                    type="number"
                                    value={breHeight}
                                    onChange={(e) => setBreHeight(e.target.value)}
                                    className="w-24 border border-gray-300 px-2 py-1 rounded"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={breSuppression} onChange={(e) => setBreSuppression(e.target.checked)} />
                                <span className="font-medium">Sprinklered (doubles boundary distance)</span>
                            </label>
                        </div>

                        {derivedElevations.length === 0 ? (
                            <p className="text-sm text-gray-600 mb-3">
                                Draw a wall polyline first — its corners define the elevations.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="text-xs border-collapse w-full">
                                    <thead>
                                        <tr className="text-left border-b">
                                            <th className="py-1 pr-2">Elevation</th>
                                            <th className="py-1 pr-2">Width (m)</th>
                                            <th className="py-1 pr-2">Boundary dist (m)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {derivedElevations.map((e, idx) => (
                                            <tr key={idx} className="border-b">
                                                <td className="py-1 pr-2">{idx + 1}</td>
                                                <td className="py-1 pr-2">{e.width.toFixed(1)}</td>
                                                <td className="py-1 pr-2">
                                                    <input
                                                        type="number"
                                                        value={bdInputs[idx] ?? ''}
                                                        placeholder={e.boundaryDistance == null ? 'enter' : ''}
                                                        onChange={(ev) => updateBd(idx, ev.target.value)}
                                                        className="w-24 border border-gray-300 px-2 py-1 rounded"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <p className="text-xs text-gray-500 mt-2 mb-3">
                            BRE 135 enclosing-rectangle method. Elevations come from the corners of
                            the drawn wall (width = each face&apos;s length, area = width × height).
                            Boundary distance defaults to the closest approach of each elevation to
                            the drawn boundary line — edit to override. Where the building is
                            sprinklered the boundary distance is doubled before the BRE 135 lookup.
                        </p>

                        {breError && <p className="text-red-600 text-sm mb-2">{breError}</p>}

                        <div className="flex gap-2">
                            <button
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                                onClick={handleBreCalc}
                                disabled={breLoading}
                            >
                                {breLoading ? 'Calculating…' : 'Calc'}
                            </button>
                            <button
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-lg disabled:opacity-50"
                                onClick={handleBreReport}
                                disabled={reportLoading}
                            >
                                {reportLoading ? 'Generating…' : 'Download report'}
                            </button>
                        </div>

                        {breResult && (
                            <div className="mt-4 border-t pt-3">
                                <h3 className="text-sm font-semibold mb-2">Results per elevation</h3>
                                <div className="overflow-x-auto">
                                    <table className="text-xs border-collapse whitespace-nowrap">
                                        <thead>
                                            <tr className="text-left border-b">
                                                {BRE_HEADERS.map((h) => (
                                                    <th key={h} className="py-1 pr-3">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breResult.elevations.map((r) => (
                                                <tr key={r.elevation_number} className="border-b">
                                                    {breRowCells(r).map((cell, i) => (
                                                        <td key={i} className="py-1 pr-3">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default EfsPopup
