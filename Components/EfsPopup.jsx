import { useState } from 'react'
import useStore from '../store/useStore'
import { assessElevation, celsiusToKelvin } from '../utils/efsViewFactor'

// EFS (External Fire Spread) inputs + result popup. v1: whole-elevation emitter.
// The wall and the relevant-boundary polyline come off the drawn `efsWall` /
// `efsBoundary` lines (converted to metres); the engineer supplies elevation
// height, fire temperature and column spacing (the radiation threshold is the
// fixed BR 187 12.6 kW/m²). On Run we sweep gridlines on the column grid,
// goal-seek the required boundary distance at each, and — if a boundary is drawn
// — compare it to the actual (closest) boundary distance for pass/fail. See
// utils/efsViewFactor.js.
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

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={() => onClose && onClose()}
        >
            <div
                className="relative bg-white p-5 rounded-lg shadow-lg text-black w-full max-w-md max-h-[85vh] overflow-auto"
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
                        <table className="w-full text-xs mt-3 border-collapse">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-1 pr-2">Gridline</th>
                                    <th className="py-1 pr-2">Left (m)</th>
                                    <th className="py-1 pr-2">Right (m)</th>
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
                )}
            </div>
        </div>
    )
}

export default EfsPopup
