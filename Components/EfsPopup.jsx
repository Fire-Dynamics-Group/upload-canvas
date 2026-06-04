import { useState } from 'react'
import useStore from '../store/useStore'
import {
    assessElevationBays,
    suggestProtection,
    celsiusToKelvin,
    polylineLength,
    projectSpanOntoWall,
    baysCoveredBySpan,
} from '../utils/efsViewFactor'

// EFS (External Fire Spread) inputs + result popup. v1: whole-elevation emitter
// split into column bays. The wall and the relevant-boundary polyline come off
// the drawn `efsWall` / `efsBoundary` lines (converted to metres); the engineer
// supplies elevation height, fire temperature and column spacing (the radiation
// threshold is the fixed BR 187 12.6 kW/m²). On Run we lay the column bays,
// goal-seek the required boundary distance at each bay's worst point and — if a
// boundary is drawn — compare it to the actual (perpendicular) boundary distance
// for pass/fail.
//
// Issue #8: bays can be PROTECTED (made fire-rated), removing them from the
// emitter — by hand (the table toggle) or via "Suggest protection".
//
// Issue #11: the engineer can also draw PROTECTED / UNPROTECTED region polylines
// on the elevation, each snapping to whole bays and carrying a vertical band
// (sill→head, capped at the elevation height). A protected band is removed from
// the emitter (its complement still radiates); an unprotected band must stay open
// (locked out of auto-suggest, and a protected band may not overlap it). All of
// it shares one model with the auto-suggester. See utils/efsViewFactor.js.
const EfsPopup = ({ onClose }) => {
    const convertedPoints = useStore((state) => state.convertedPoints)

    const [height, setHeight] = useState(18)
    const [fireTempC, setFireTempC] = useState(1040)
    // Column spacing along the elevation: the gridlines sit on the building's
    // column lines (so results map to the drawing), per the spreadsheet. Shared
    // with the canvas boundary-distance overlay via the store. NOT the px->m
    // scale (that's the scale tool / pixelsPerMesh).
    const columnSpacing = useStore((state) => state.efsColumnSpacing)
    const setColumnSpacing = useStore((state) => state.setEfsColumnSpacing)
    const setEfsCalcDone = useStore((state) => state.setEfsCalcDone)
    // Shared protected-bay model (issue #8).
    const protectedBays = useStore((state) => state.efsProtectedBays)
    const setProtectedBays = useStore((state) => state.setEfsProtectedBays)
    const toggleProtectedBay = useStore((state) => state.toggleEfsProtectedBay)
    const cornersFirst = useStore((state) => state.efsCornersFirst)
    const setCornersFirst = useStore((state) => state.setEfsCornersFirst)
    const setRequiredByStation = useStore((state) => state.setEfsRequiredByStation)
    // Region bands (issue #11), keyed by drawn region element id.
    const regionConfig = useStore((state) => state.efsRegionConfig)
    const setRegionBand = useStore((state) => state.setEfsRegionBand)

    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [suggestNote, setSuggestNote] = useState(null)

    // Pull the validated wall + global inputs out of the drawn elements / fields.
    // Returns { wall, boundary, h, sp, T } or null (and sets the error).
    function readInputs() {
        const wall = (convertedPoints || []).find((el) => el.comments === 'efsWall')
        if (!wall || !wall.finalPoints || wall.finalPoints.length < 2) {
            setError('No wall line found — draw a wall first.')
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
        return { wall, boundary, h, sp, T: celsiusToKelvin(Number(fireTempC)) }
    }

    // Drawn region polylines (efsProtected / efsUnprotected) projected onto the
    // wall, snapped to the bays they cover, with their configured vertical band.
    function buildRegions(wallFinalPoints, width, spacing, h) {
        const regs = []
        for (const el of (convertedPoints || [])) {
            if (el.comments !== 'efsProtected' && el.comments !== 'efsUnprotected') continue
            if (!el.finalPoints || el.finalPoints.length < 1) continue
            const { start, end } = projectSpanOntoWall(wallFinalPoints, el.finalPoints)
            const bays = baysCoveredBySpan(width, spacing, start, end)
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

    // Assess with a given protected-bay set (+ the drawn regions) and store it.
    function assess(bays) {
        const inp = readInputs()
        if (!inp) return null
        const width = polylineLength(inp.wall.finalPoints)
        const regions = buildRegions(inp.wall.finalPoints, width, inp.sp, inp.h)
        const res = assessElevationBays({
            wallPoints: inp.wall.finalPoints,
            boundaryPoints: inp.boundary ? inp.boundary.finalPoints : [],
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            protectedBays: bays,
            regions,
        })
        res._regions = regions
        setResult(res)
        setRequiredByStation(res.requiredByStation)
        setEfsCalcDone(true)
        return res
    }

    function handleRun() {
        setSuggestNote(null)
        assess(protectedBays)
    }

    function handleToggleBay(bay) {
        toggleProtectedBay(bay)
        setSuggestNote(null)
        const next = protectedBays.includes(bay)
            ? protectedBays.filter((b) => b !== bay)
            : [...protectedBays, bay]
        assess(next)
    }

    function handleSuggest() {
        const inp = readInputs()
        if (!inp) return
        if (!inp.boundary) {
            setError('Draw a Boundary polyline before suggesting protection.')
            return
        }
        const width = polylineLength(inp.wall.finalPoints)
        const regions = buildRegions(inp.wall.finalPoints, width, inp.sp, inp.h)
        const sug = suggestProtection({
            wallPoints: inp.wall.finalPoints,
            boundaryPoints: inp.boundary.finalPoints,
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            cornersFirst,
            regions,
        })
        setProtectedBays(sug.protectedBays)
        sug.assessment._regions = regions
        setResult(sug.assessment)
        setRequiredByStation(sug.assessment.requiredByStation)
        setEfsCalcDone(true)
        if (sug.achievable) {
            const n = sug.protectedBays.length
            setSuggestNote(n === 0
                ? 'Already compliant — no protection needed.'
                : `Protected ${n} bay${n === 1 ? '' : 's'} (${sug.protectedBays.join(', ')}) to achieve compliance.`)
        } else {
            setSuggestNote('Compliance not achievable by protecting bays alone (an unprotected constraint may govern).')
        }
    }

    function handleClearProtection() {
        setProtectedBays([])
        setSuggestNote(null)
        assess([])
    }

    // Update a region's band (sill/head), clamped to [0, height], and re-assess.
    function updateRegionBand(id, patch) {
        const h = Number(height)
        const clamp = (v) => Math.max(0, Math.min(h, Number(v)))
        const next = {}
        if (patch.base != null) next.base = clamp(patch.base)
        if (patch.top != null) next.top = clamp(patch.top)
        setRegionBand(id, next)
        setSuggestNote(null)
        // re-assess on the next tick so the store update is applied first
        setTimeout(() => assess(protectedBays), 0)
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

    const regions = result?._regions || []

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
                <p className="text-xs text-gray-500 mb-3">Radiation threshold fixed at 12.6 kW/m² (BR 187).</p>

                {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        onClick={handleRun}
                    >
                        Run Calc
                    </button>
                    <button
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                        onClick={handleSuggest}
                    >
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
                        <input
                            type="checkbox"
                            checked={cornersFirst}
                            onChange={(e) => setCornersFirst(e.target.checked)}
                        />
                        Corners first
                    </label>
                </div>

                {suggestNote && <p className="text-sm mt-2 text-amber-800">{suggestNote}</p>}

                {/* Drawn protected/unprotected regions: set each region's vertical
                    band (sill/head). Draw the polylines with the Protected /
                    Unprotected tools first, then Run Calc. */}
                {regions.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                        <p className="text-sm font-medium mb-2">Regions (sill → head, m)</p>
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

                {result && (
                    <div className="mt-4 border-t pt-3">
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
