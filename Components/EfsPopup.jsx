import { useState } from 'react'
import useStore from '../store/useStore'
import { assessElevation, celsiusToKelvin, polylineLength } from '../utils/efsViewFactor'
import { calculateEfs, downloadEfsReport } from './ApiCalls'

// EFS (External Fire Spread) inputs + results popup. Two methods live behind
// tabs:
//   1. "View factor (BR 187)" — the in-browser whole-elevation emitter sweep.
//      The wall / relevant-boundary polylines come off the drawn `efsWall` /
//      `efsBoundary` lines (converted to metres); the engineer supplies elevation
//      height, fire temperature and column spacing. On Run we sweep gridlines,
//      goal-seek the required boundary distance, and compare to the actual
//      distance for pass/fail. See utils/efsViewFactor.js.
//   2. "Enclosing rectangle (BRE 135)" — the ported backend app
//      (backendForNextApp routers/efs.py). The engineer enters one row per
//      elevation (boundary distance, ER width/height, suppression) and we POST
//      to /efs/calculate, rendering the per-elevation unprotected-area table.
const EfsPopup = ({ onClose }) => {
    const convertedPoints = useStore((state) => state.convertedPoints)

    const [activeTab, setActiveTab] = useState('viewFactor')

    // ---- View factor (BR 187) tab state ----
    const [height, setHeight] = useState(18)
    const [fireTempC, setFireTempC] = useState(1040)
    // Column spacing along the elevation: the gridlines sit on the building's
    // column lines (so results map to the drawing), per the spreadsheet. Shared
    // with the canvas boundary-distance overlay via the store. NOT the px->m
    // scale (that's the scale tool / pixelsPerMesh).
    const columnSpacing = useStore((state) => state.efsColumnSpacing)
    const setColumnSpacing = useStore((state) => state.setEfsColumnSpacing)
    const setEfsCalcDone = useStore((state) => state.setEfsCalcDone)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    function handleRun() {
        const wall = (convertedPoints || []).find((el) => el.comments === 'efsWall')
        if (!wall || !wall.finalPoints || wall.finalPoints.length < 2) {
            setError('No wall line found — draw a wall first.')
            return
        }
        const boundary = (convertedPoints || []).find((el) => el.comments === 'efsBoundary')
        const h = Number(height)
        const sp = Number(columnSpacing)
        if (!(h > 0) || !(sp > 0)) {
            setError('Height and column spacing must be positive.')
            return
        }
        setError(null)
        const T = celsiusToKelvin(Number(fireTempC))
        // Target is the fixed BR 187 boundary criterion (12.6 kW/m^2).
        const res = assessElevation({
            wallPoints: wall.finalPoints,
            boundaryPoints: boundary ? boundary.finalPoints : [],
            height: h,
            T,
            spacing: sp,
        })
        setResult(res)
        setEfsCalcDone(true)
    }

    // ---- Enclosing rectangle (BRE 135) tab state ----
    // Seed the first elevation's width from the drawn wall when available so the
    // two methods stay tied to the same drawing.
    const drawnWallWidth = (() => {
        const wall = (convertedPoints || []).find((el) => el.comments === 'efsWall')
        if (wall && wall.finalPoints && wall.finalPoints.length >= 2) {
            return Math.round(polylineLength(wall.finalPoints) * 10) / 10
        }
        return ''
    })()

    const [isCommercial, setIsCommercial] = useState(true)
    const [elevations, setElevations] = useState([
        { boundary_distance: 6, width: drawnWallWidth, height: 18, has_suppression: false },
    ])
    const [breResult, setBreResult] = useState(null)
    const [breError, setBreError] = useState(null)
    const [breLoading, setBreLoading] = useState(false)
    const [reportLoading, setReportLoading] = useState(false)

    const updateElevation = (idx, field, value) => {
        setElevations((rows) =>
            rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
        )
    }

    const addElevation = () => {
        setElevations((rows) => [
            ...rows,
            { boundary_distance: 6, width: '', height: 18, has_suppression: false },
        ])
    }

    const removeElevation = (idx) => {
        setElevations((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows))
    }

    const buildPayload = () => {
        const payload = elevations.map((r) => ({
            boundary_distance: Number(r.boundary_distance),
            width: Number(r.width),
            height: Number(r.height),
            has_suppression: !!r.has_suppression,
        }))
        const bad = payload.some(
            (e) =>
                !Number.isFinite(e.boundary_distance) ||
                !(e.width > 0) ||
                !(e.height > 0),
        )
        return { payload, bad }
    }

    async function handleBreCalc() {
        const { payload, bad } = buildPayload()
        if (bad) {
            setBreError('Each elevation needs a boundary distance and positive width/height.')
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
        const { payload, bad } = buildPayload()
        if (bad) {
            setBreError('Each elevation needs a boundary distance and positive width/height.')
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

    const tabClass = (key) =>
        `px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
        }`

    const BRE_HEADERS = [
        'Elevation',
        'Boundary Dist (m)',
        'ER Width (m)',
        'ER Height (m)',
        'BRE Width (m)',
        'BRE Height (m)',
        'BRE % Unprotected',
        'Allowable Area (m²)',
        'Actual Area (m²)',
        'Actual Allowable Area (m²)',
        'Actual % Unprotected',
    ]

    const breRowCells = (r) => [
        r.elevation_number,
        r.boundary_distance,
        r.er_width,
        r.er_height,
        r.bre_width,
        r.bre_height,
        r.bre_percentage,
        r.allowable_area,
        r.actual_area,
        r.actual_protected_area,
        r.actual_percentage,
    ]

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
                    <button
                        type="button"
                        className={tabClass('viewFactor')}
                        onClick={() => setActiveTab('viewFactor')}
                    >
                        View factor (BR 187)
                    </button>
                    <button
                        type="button"
                        className={tabClass('bre135')}
                        onClick={() => setActiveTab('bre135')}
                    >
                        Enclosing rectangle (BRE 135)
                    </button>
                </div>

                {activeTab === 'viewFactor' && (
                    <div>
                        {numberField('Elevation height (m)', height, setHeight)}
                        {numberField('Fire temperature (°C)', fireTempC, setFireTempC)}
                        {numberField('Column spacing (m)', columnSpacing, setColumnSpacing)}
                        <p className="text-xs text-gray-500 mb-3">Radiation threshold fixed at 12.6 kW/m² (BR 187).</p>

                        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

                        <button
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                            onClick={handleRun}
                        >
                            Run Calc
                        </button>

                        {result && (
                            <div className="mt-4 border-t pt-3">
                                <p className="text-sm">Elevation width (from wall): <b>{result.width.toFixed(2)} m</b></p>
                                <p className="text-base mt-1">
                                    Governing required boundary distance:{' '}
                                    <b>{result.governingRequiredBoundaryDistance.toFixed(2)} m</b>
                                </p>
                                {result.hasBoundary ? (
                                    <p className={`text-sm mt-1 ${result.allPass ? 'text-green-700' : 'text-red-700'}`}>
                                        {result.allPass
                                            ? 'All gridlines compliant.'
                                            : `${result.failingCount} gridline(s) exceed the 12.6 kW/m² boundary criterion.`}
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
                                                <th className="py-1 pr-2">Gridline</th>
                                                <th className="py-1 pr-2">Left width (m)</th>
                                                <th className="py-1 pr-2">Right width (m)</th>
                                                <th className="py-1 pr-2">Bottom_h (m)</th>
                                                <th className="py-1 pr-2">Top_h (m)</th>
                                                <th className="py-1 pr-2">View factor</th>
                                                <th className="py-1 pr-2">I<sub>s</sub> (kW/m²)</th>
                                                <th className="py-1 pr-2">S (m)</th>
                                                <th className="py-1 pr-2">Required (m)</th>
                                                <th className="py-1 pr-2">Actual (m)</th>
                                                <th className="py-1 pr-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.rows.map((r) => (
                                                <tr
                                                    key={r.gridline}
                                                    className={`border-b ${r.pass === false ? 'bg-red-50' : ''}`}
                                                >
                                                    <td className="py-1 pr-2">{r.gridline}</td>
                                                    <td className="py-1 pr-2">{r.leftW.toFixed(1)}</td>
                                                    <td className="py-1 pr-2">{r.rightW.toFixed(1)}</td>
                                                    <td className="py-1 pr-2">{r.bottomH.toFixed(1)}</td>
                                                    <td className="py-1 pr-2">{r.topH.toFixed(1)}</td>
                                                    <td className="py-1 pr-2">{r.viewFactorTotal.toFixed(5)}</td>
                                                    <td className="py-1 pr-2">{r.incident.toFixed(2)}</td>
                                                    <td className="py-1 pr-2">{r.S.toFixed(2)}</td>
                                                    <td className="py-1 pr-2">{r.requiredBoundaryDistance.toFixed(2)}</td>
                                                    <td className="py-1 pr-2">
                                                        {r.actualBoundaryDistance == null ? '—' : r.actualBoundaryDistance.toFixed(2)}
                                                    </td>
                                                    <td className="py-1 pr-2">
                                                        {r.pass == null ? '—' : (r.pass ? 'OK' : 'FAIL')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'bre135' && (
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <span className="text-sm font-medium">Building type:</span>
                            <label className="flex items-center gap-1 text-sm">
                                <input
                                    type="radio"
                                    name="breBuildingType"
                                    checked={isCommercial}
                                    onChange={() => setIsCommercial(true)}
                                />
                                Commercial
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                                <input
                                    type="radio"
                                    name="breBuildingType"
                                    checked={!isCommercial}
                                    onChange={() => setIsCommercial(false)}
                                />
                                Residential
                            </label>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="text-xs border-collapse w-full">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-1 pr-2">#</th>
                                        <th className="py-1 pr-2">Boundary dist (m)</th>
                                        <th className="py-1 pr-2">ER width (m)</th>
                                        <th className="py-1 pr-2">ER height (m)</th>
                                        <th className="py-1 pr-2">Suppression</th>
                                        <th className="py-1 pr-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {elevations.map((r, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td className="py-1 pr-2">{idx + 1}</td>
                                            <td className="py-1 pr-2">
                                                <input
                                                    type="number"
                                                    value={r.boundary_distance}
                                                    onChange={(e) => updateElevation(idx, 'boundary_distance', e.target.value)}
                                                    className="w-24 border border-gray-300 px-2 py-1 rounded"
                                                />
                                            </td>
                                            <td className="py-1 pr-2">
                                                <input
                                                    type="number"
                                                    value={r.width}
                                                    onChange={(e) => updateElevation(idx, 'width', e.target.value)}
                                                    className="w-24 border border-gray-300 px-2 py-1 rounded"
                                                />
                                            </td>
                                            <td className="py-1 pr-2">
                                                <input
                                                    type="number"
                                                    value={r.height}
                                                    onChange={(e) => updateElevation(idx, 'height', e.target.value)}
                                                    className="w-24 border border-gray-300 px-2 py-1 rounded"
                                                />
                                            </td>
                                            <td className="py-1 pr-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={!!r.has_suppression}
                                                    onChange={(e) => updateElevation(idx, 'has_suppression', e.target.checked)}
                                                />
                                            </td>
                                            <td className="py-1 pr-2">
                                                <button
                                                    type="button"
                                                    aria-label="Remove elevation"
                                                    className="text-gray-400 hover:text-red-600"
                                                    onClick={() => removeElevation(idx)}
                                                >
                                                    &times;
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                            onClick={addElevation}
                        >
                            + Add elevation
                        </button>

                        <p className="text-xs text-gray-500 mt-2 mb-3">
                            BRE 135 enclosing-rectangle method. Where suppression is provided the
                            boundary distance is doubled before the BRE 135 lookup (a more
                            permissive allowable unprotected area).
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
