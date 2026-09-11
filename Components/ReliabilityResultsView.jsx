import { useMemo, useState } from 'react'
import useStore from '../store/useStore'
import { sendTimeEqReliabilityChartsData, downloadReliabilityCharts } from './ApiCalls'
import { downloadReliabilityResultsCsv } from '../utils/reliabilityResults'
import {
    reliabilityRequestOptionsFromInputs,
    reliabilityResultLines,
} from '../utils/teqReliabilityConstants'

const PAGE_SIZE = 100

// Full-screen QA view for the Monte Carlo reliability run — the time-eq
// analogue of the full MACS+ report table. Reruns the exact run shown in the
// popup (same stored inputs, same seed) with the per-sample table included,
// so every row can be spot-checked against a hand calc.
export default function ReliabilityResultsView() {
    const convertedPoints = useStore((s) => s.convertedPoints)
    const savedInputs = useStore((s) => s.timeEqInputs)
    const savedResult = useStore((s) => s.timeEqResult)

    const [results, setResults] = useState(null)   // full body: summary + charts + samples + derived
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)
    const [failedOnly, setFailedOnly] = useState(false)
    const [page, setPage] = useState(0)

    const canRun = Boolean(savedInputs && (convertedPoints || []).length)

    async function generate() {
        setBusy(true)
        setError(null)
        try {
            const body = await sendTimeEqReliabilityChartsData(convertedPoints, {
                ...reliabilityRequestOptionsFromInputs(savedInputs),
                // Reproduce the run the popup showed; absent (older saved
                // results) the backend picks a seed and reports it.
                seed: savedResult?.seed ?? null,
                includeSamples: true,
            })
            setResults(body)
            setPage(0)
        } catch (e) {
            setError(e?.message || 'Full results failed')
        } finally {
            setBusy(false)
        }
    }

    const samples = results?.samples || []
    const visible = useMemo(
        () => (failedOnly ? samples.filter((s) => s.failed) : samples),
        [samples, failedOnly],
    )
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
    const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    const derived = results?.derived

    return (
        <div className="fixed inset-0 z-[90] bg-gray-900 flex flex-col">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800 text-white">
                <span className="text-sm font-medium">Reliability Results</span>
                <button
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
                    onClick={generate}
                    disabled={busy || !canRun}
                >
                    {busy ? 'Running…' : results ? 'Re-run Full Results' : 'Generate Full Results'}
                </button>
                {results && (
                    <>
                        <button
                            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                            onClick={() => downloadReliabilityCharts(results.charts, results.seed)}
                        >
                            Download Charts
                        </button>
                        <button
                            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                            onClick={() => downloadReliabilityResultsCsv(samples, results.seed)}
                        >
                            Download CSV
                        </button>
                    </>
                )}
                {error && <span className="text-sm text-red-400">{error}</span>}
                {!canRun && (
                    <span className="text-sm text-gray-400">
                        Draw a compartment and set up Monte Carlo Reliability in the Time Equivalence popup first.
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4 text-gray-100">
                {!results && !busy && savedResult && (
                    <div className="mb-4 p-3 bg-gray-800 rounded-md max-w-xl">
                        <p className="text-sm text-gray-400 mb-1">Last run (from the popup):</p>
                        {reliabilityResultLines(savedResult).map((line, i) => (
                            <p key={i} className={i === 0 ? 'font-bold' : 'text-sm'}>{line}</p>
                        ))}
                    </div>
                )}

                {results && (
                    <div className="flex flex-col gap-4 max-w-5xl">
                        <div className="p-3 bg-gray-800 rounded-md">
                            {reliabilityResultLines(results).map((line, i) => (
                                <p key={i} className={i === 0 ? 'text-lg font-bold' : 'text-sm'}>{line}</p>
                            ))}
                            <p className="text-sm text-gray-400 mt-1">Seed {results.seed}</p>
                        </div>

                        {derived && (
                            <div className="p-3 bg-gray-800 rounded-md text-sm">
                                <p className="font-medium mb-1">Derived geometry (QA)</p>
                                <p>Floor area {derived.floorArea?.toFixed(2)} m² · Enclosure area {derived.totalArea?.toFixed(2)} m²</p>
                                <p>Wall lengths: {derived.wallLengths?.map((w) => w.toFixed(2)).join(', ')} m</p>
                                <p>Openable widths: {derived.ventWidths?.join(', ')} m · Vent heights: {derived.ventHeights?.join(', ')} m</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <img
                                src={`data:image/png;base64,${results.charts.steelTempSpaghetti}`}
                                alt="Steel time-temperature curves with critical temperature line"
                                className="w-full rounded-md bg-white"
                            />
                            <img
                                src={`data:image/png;base64,${results.charts.passFailScatter}`}
                                alt="Pass/fail scatter: glazing breakage vs fireload"
                                className="w-full rounded-md bg-white"
                            />
                        </div>

                        <div className="p-3 bg-gray-800 rounded-md">
                            <div className="flex items-center gap-4 mb-2 text-sm">
                                <span className="font-medium">Per-sample results ({visible.length})</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={failedOnly}
                                        onChange={(e) => { setFailedOnly(e.target.checked); setPage(0) }}
                                    />
                                    failed only
                                </label>
                                <span className="ml-auto flex items-center gap-2">
                                    <button
                                        className="px-2 bg-gray-700 rounded disabled:opacity-40"
                                        onClick={() => setPage(page - 1)} disabled={page === 0}
                                    >‹</button>
                                    page {page + 1} / {pages}
                                    <button
                                        className="px-2 bg-gray-700 rounded disabled:opacity-40"
                                        onClick={() => setPage(page + 1)} disabled={page >= pages - 1}
                                    >›</button>
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-gray-400 border-b border-gray-700">
                                        <tr>
                                            <th className="py-1 pr-3">#</th>
                                            <th className="py-1 pr-3">Fuel load (MJ/m²)</th>
                                            <th className="py-1 pr-3">Glazing breakage (%)</th>
                                            <th className="py-1 pr-3">Opening factor</th>
                                            <th className="py-1 pr-3">Peak steel temp (°C)</th>
                                            <th className="py-1">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((s) => (
                                            <tr key={s.index} className="border-b border-gray-800">
                                                <td className="py-1 pr-3 text-gray-400">{s.index}</td>
                                                <td className="py-1 pr-3">{s.fuelLoad.toFixed(1)}</td>
                                                <td className="py-1 pr-3">{(s.glazingBreakage * 100).toFixed(1)}</td>
                                                <td className="py-1 pr-3">{s.openingFactor.toFixed(4)}</td>
                                                <td className="py-1 pr-3">{s.peakSteelTemp.toFixed(1)}</td>
                                                <td className={`py-1 font-medium ${s.failed ? 'text-orange-400' : 'text-blue-300'}`}>
                                                    {s.failed ? 'FAIL' : 'pass'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Full precision in the CSV download — the on-screen table rounds for reading.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
