import { useState } from 'react'
import MacsCharts from './MacsCharts'
import MacsSetupPanel from './MacsSetupPanel'

export default function MacsRunDetail({ run, batchSetup = null, onApplyToTimeEq }) {
    const [copied, setCopied] = useState(false)
    const [showTsTable, setShowTsTable] = useState(false)
    const [showInputs, setShowInputs] = useState(false)
    const [appliedNotice, setAppliedNotice] = useState(false)

    if (!run) {
        return (
            <div className="p-8 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
                <span className="text-3xl block mb-2">📊</span>
                <p className="font-medium text-gray-700">No MACS run selected</p>
                <p className="text-xs text-gray-500 mt-1">Select a run from the list or push one from the desktop app.</p>
            </div>
        )
    }

    const outputs = run.outputs || {}
    const inputs = run.inputs || {}
    const checks = Array.isArray(run.checks) ? run.checks : []
    const timeSeries = Array.isArray(run.time_series) ? run.time_series : []

    const criticalTemp = run.critical_temp !== undefined ? run.critical_temp : outputs.side_b_critical_temp || 550
    const governingSide = run.governing_side || 'B'
    const section = run.section || inputs.u_sec_size || 'UB 457x191x82'
    const sectionFactor = run.section_factor || 140
    const timeStr = run.client_timestamp ? new Date(run.client_timestamp).toLocaleString() : ''

    const handleCopy = () => {
        navigator.clipboard?.writeText(String(Math.round(criticalTemp)))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleApply = () => {
        if (onApplyToTimeEq) {
            onApplyToTimeEq(run)
            setAppliedNotice(true)
            setTimeout(() => setAppliedNotice(false), 3000)
        }
    }

    const sides = ['a', 'b', 'c', 'd']

    return (
        <div className="space-y-4">
            {/* Run Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                        {run.label || `MACS Run #${run.run_id || run.id?.slice(0, 8)}`}
                    </h2>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1 mt-1 font-mono">
                        {timeStr && <span>🕐 {timeStr}</span>}
                        {run.windows_user && <span>👤 {run.windows_user}</span>}
                        {run.machine_name && <span>💻 {run.machine_name}</span>}
                        {outputs.engine_version && <span>⚙️ FRACOF v{outputs.engine_version}</span>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleApply}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm transition-colors flex items-center gap-1.5"
                    >
                        <span>⚡</span>
                        <span>{appliedNotice ? 'Applied to Time Eq!' : 'Apply to Time Eq'}</span>
                    </button>
                </div>
            </div>

            {/* Governing Critical Temperature Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <span className="text-xs uppercase font-semibold tracking-wider text-blue-800">
                            Governing Perimeter Beam Critical Temperature
                        </span>
                        <div className="flex items-baseline gap-3 mt-1">
                            <span className="text-3xl font-extrabold text-blue-950 tabular-nums">
                                {Math.round(criticalTemp)} °C
                            </span>
                            <span className="text-sm font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                                Side {governingSide} governs
                            </span>
                            <span className="text-xs text-gray-600 font-mono">
                                Section: {section} • Ap/V: {sectionFactor} m⁻¹
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 text-xs font-medium px-2.5 py-1 rounded"
                        >
                            {copied ? 'Copied ✓' : 'Copy °C'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Shared Batch Setup Panel if available */}
            {batchSetup && (
                <MacsSetupPanel
                    setup={batchSetup}
                    defaultOpen={false}
                    title="MACS RUN SETUP"
                    subtitle="Fixed geometry, deck, slab & beam parameters"
                />
            )}

            {/* Key Summary Badges & Perimeter Beams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Perimeter Beams Breakdown */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-xs uppercase font-semibold tracking-wider text-gray-500 mb-2">
                        Perimeter Beams (Sides A - D)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500">
                                    <th className="py-1">Side</th>
                                    <th className="py-1">Critical Temp</th>
                                    <th className="py-1">Load Ratio</th>
                                    <th className="py-1">Section</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sides.map((s) => {
                                    const sUpper = s.toUpperCase()
                                    const isGov = sUpper === governingSide
                                    const t = outputs[`side_${s}_critical_temp`] || (isGov ? criticalTemp : null)
                                    const lr = outputs[`side_${s}_load_ratio`]
                                    const sec = run[`side_${s}_sec`] || (isGov ? section : '-')
                                    return (
                                        <tr
                                            key={s}
                                            className={`border-b border-gray-100 ${
                                                isGov ? 'bg-blue-50/70 font-semibold text-blue-900' : 'text-gray-700'
                                            }`}
                                        >
                                            <td className="py-1.5 flex items-center gap-1">
                                                <span>Side {sUpper}</span>
                                                {isGov && <span className="text-[10px] bg-blue-200 text-blue-800 px-1 rounded">GOV</span>}
                                            </td>
                                            <td className="py-1.5 tabular-nums">
                                                {t !== null && t !== undefined ? `${Math.round(t)} °C` : '-'}
                                            </td>
                                            <td className="py-1.5 tabular-nums">
                                                {lr !== null && lr !== undefined ? lr.toFixed(2) : '-'}
                                            </td>
                                            <td className="py-1.5 text-gray-600">{sec}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Metrics & Checks */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs uppercase font-semibold tracking-wider text-gray-500 mb-2">
                            Slab & Structural Checks
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="text-gray-500 block text-[10px]">Max Utilization (UF)</span>
                                <span className="text-base font-bold text-slate-800">
                                    {outputs.uf_max !== undefined ? outputs.uf_max.toFixed(2) : '-'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="text-gray-500 block text-[10px]">Max Deflection</span>
                                <span className="text-base font-bold text-slate-800">
                                    {outputs.max_deflection !== undefined ? `${Math.round(outputs.max_deflection)} mm` : '-'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="text-gray-500 block text-[10px]">Factored Hot Load</span>
                                <span className="text-base font-bold text-slate-800">
                                    {outputs.factored_hot !== undefined ? `${outputs.factored_hot.toFixed(1)} kN/m²` : '-'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="text-gray-500 block text-[10px]">Composite Status</span>
                                <span className={`text-base font-bold ${outputs.comp_failure ? 'text-red-600' : 'text-emerald-700'}`}>
                                    {outputs.comp_failure ? 'Failure' : 'Passed'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {checks.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                            {checks.map((chk, i) => (
                                <span
                                    key={i}
                                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                        chk.pass
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                    }`}
                                >
                                    {chk.pass ? '✓' : '✗'} {chk.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Time-Series Charts */}
            <MacsCharts
                timeSeries={timeSeries}
                factoredHot={outputs.factored_hot}
                timeLimit={inputs.time_limit}
            />

            {/* Collapsible: Time Series Data Table */}
            {timeSeries.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowTsTable(!showTsTable)}
                        className="w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 flex items-center justify-between"
                    >
                        <span>Step-by-step Time Series History ({timeSeries.length} points)</span>
                        <span>{showTsTable ? '▲ Hide' : '▼ Expand'}</span>
                    </button>
                    {showTsTable && (
                        <div className="max-h-72 overflow-y-auto p-2">
                            <table className="min-w-full text-[11px] text-left">
                                <thead className="bg-gray-100 text-gray-600 sticky top-0">
                                    <tr>
                                        <th className="p-1">Step</th>
                                        <th className="p-1">Time (min)</th>
                                        <th className="p-1">Fire (°C)</th>
                                        <th className="p-1">Beam (°C)</th>
                                        <th className="p-1">Mesh (°C)</th>
                                        <th className="p-1">Slab Top</th>
                                        <th className="p-1">Slab Bot</th>
                                        <th className="p-1">Defl (mm)</th>
                                        <th className="p-1">UF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSeries.map((row, idx) => (
                                        <tr key={idx} className="border-b border-gray-100 font-mono hover:bg-gray-50">
                                            <td className="p-1">{row.time_step}</td>
                                            <td className="p-1">{row.time_min?.toFixed(1)}</td>
                                            <td className="p-1">{row.fire_temp?.toFixed(0) || '-'}</td>
                                            <td className="p-1">{row.lofl_temp?.toFixed(0) || '-'}</td>
                                            <td className="p-1">{row.mesh_temp?.toFixed(0) || '-'}</td>
                                            <td className="p-1">{row.slabtop_temp?.toFixed(0) || '-'}</td>
                                            <td className="p-1">{row.slabbot_temp?.toFixed(0) || '-'}</td>
                                            <td className="p-1">{row.deflection?.toFixed(1) || '-'}</td>
                                            <td className="p-1">{row.utilization_factor?.toFixed(2) || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Collapsible: Setup Parameters Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <button
                    type="button"
                    onClick={() => setShowInputs(!showInputs)}
                    className="w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 flex items-center justify-between"
                >
                    <span>Run Setup & FRACOF Parameters ({Object.keys(inputs).length} variables)</span>
                    <span>{showInputs ? '▲ Hide' : '▼ Expand'}</span>
                </button>
                {showInputs && (
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono bg-slate-50">
                        {Object.entries(inputs).map(([k, v]) => (
                            <div key={k} className="p-1.5 bg-white rounded border border-gray-100">
                                <span className="text-gray-400 block text-[10px]">{k}</span>
                                <span className="text-gray-800 font-medium truncate block">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
