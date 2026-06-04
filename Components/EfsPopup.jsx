import { useState } from 'react'
import useStore from '../store/useStore'
import { assessElevationBays, suggestProtection, celsiusToKelvin } from '../utils/efsViewFactor'

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
// emitter. Protect bays by hand (the table toggle / canvas click) or let
// "Suggest protection" auto-protect one bay at a time until the elevation
// passes. The protected set lives in the store (efsProtectedBays) so the table,
// the canvas overlay and the auto-suggester all share it. See
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
    const setEfsCalcDone = useStore((state) => state.setEfsCalcDone)
    // Shared protected-bay model (issue #8).
    const protectedBays = useStore((state) => state.efsProtectedBays)
    const setProtectedBays = useStore((state) => state.setEfsProtectedBays)
    const toggleProtectedBay = useStore((state) => state.toggleEfsProtectedBay)
    const cornersFirst = useStore((state) => state.efsCornersFirst)
    const setCornersFirst = useStore((state) => state.setEfsCornersFirst)

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
        return {
            wall,
            boundary,
            h,
            sp,
            T: celsiusToKelvin(Number(fireTempC)),
        }
    }

    // Assess with a given protected-bay set and store the result.
    function assess(bays) {
        const inp = readInputs()
        if (!inp) return null
        const res = assessElevationBays({
            wallPoints: inp.wall.finalPoints,
            boundaryPoints: inp.boundary ? inp.boundary.finalPoints : [],
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            protectedBays: bays,
        })
        setResult(res)
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
        // re-assess with the bay flipped (store update is async to this closure)
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
        const sug = suggestProtection({
            wallPoints: inp.wall.finalPoints,
            boundaryPoints: inp.boundary.finalPoints,
            height: inp.h,
            T: inp.T,
            spacing: inp.sp,
            cornersFirst,
        })
        setProtectedBays(sug.protectedBays)
        setResult(sug.assessment)
        setEfsCalcDone(true)
        if (sug.achievable) {
            const n = sug.protectedBays.length
            setSuggestNote(n === 0
                ? 'Already compliant — no protection needed.'
                : `Protected ${n} bay${n === 1 ? '' : 's'} (${sug.protectedBays.join(', ')}) to achieve compliance.`)
        } else {
            setSuggestNote('Compliance not achievable by protecting bays alone.')
        }
    }

    function handleClearProtection() {
        setProtectedBays([])
        setSuggestNote(null)
        assess([])
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
                                        <th className="py-1 pr-2">Protected</th>
                                        <th className="py-1 pr-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((r) => (
                                        <tr
                                            key={r.bay}
                                            className={`border-b ${r.protected ? 'bg-gray-100' : (r.pass === false ? 'bg-red-50' : '')}`}
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
                                            <td className="py-1 pr-2">
                                                {r.protected ? 'Protected' : (r.pass == null ? '—' : (r.pass ? 'OK' : 'FAIL'))}
                                            </td>
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
