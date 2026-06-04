import { useState } from 'react'
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
} from '../utils/efsViewFactor'

// EFS (External Fire Spread) inputs + result popup — BR 187 view-factor method.
//
// The engineer draws ONE outline around the whole building plus the relevant
// boundary. Issue #10: that outline is split into its ELEVATIONS (faces) at the
// real corners; each elevation gets its own tab and is assessed independently
// against the shared boundary (the full outline is used for line-of-sight so a
// face's normal can't measure through the building).
//
// Per elevation: lay column bays, goal-seek the required boundary distance at
// each bay's worst point and compare to the actual (perpendicular) distance.
// Issue #8: bays can be PROTECTED (removed from the emitter) by hand or via
// "Suggest protection". Issue #11: PROTECTED / UNPROTECTED region polylines snap
// to bays and carry a vertical band (sill→head). See utils/efsViewFactor.js.
const EfsPopup = ({ onClose }) => {
    const convertedPoints = useStore((state) => state.convertedPoints)

    const [height, setHeight] = useState(18)
    const [fireTempC, setFireTempC] = useState(1040)
    const columnSpacing = useStore((state) => state.efsColumnSpacing)
    const setColumnSpacing = useStore((state) => state.setEfsColumnSpacing)
    const setEfsCalcDone = useStore((state) => state.setEfsCalcDone)
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
                className="relative bg-white p-5 rounded-lg shadow-lg text-black w-full max-w-3xl max-h-[85vh] overflow-auto"
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
                <h2 className="text-lg font-bold mb-3">External Fire Spread — view factor</h2>

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
                                            <td className="py-1 pr-2">{r.viewFactorTotal.toFixed(5)}</td>
                                            <td className="py-1 pr-2">{r.incident.toFixed(2)}</td>
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
                    </div>
                )}
            </div>
        </div>
    )
}

export default EfsPopup
