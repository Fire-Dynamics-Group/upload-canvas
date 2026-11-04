import { useState } from 'react'

/**
 * Format numeric value without float noise
 */
function formatValue(v) {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(6)))
    }
    return String(v)
}

function withUnit(valStr, unit) {
    return unit ? `${valStr} ${unit}` : valStr
}

export default function MacsSetupPanel({
    setup = null,
    defaultOpen = true,
    runCount = null,
    title = 'SETUP',
    subtitle = null,
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    const groups = setup?.groups || []
    const totalRuns = setup?.run_count || runCount

    if (groups.length === 0) {
        return null
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">
            {/* Header toggle button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors border-b border-slate-100"
            >
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        SETUP
                    </span>
                    {totalRuns ? (
                        <span className="text-xs text-slate-400 font-normal">
                            shared across {totalRuns.toLocaleString()} runs
                        </span>
                    ) : null}
                </div>
                <span className="text-slate-400 text-xs select-none">
                    {isOpen ? '▾' : '▸'}
                </span>
            </button>

            {/* Collapsible content */}
            {isOpen && (
                <div className="p-4 bg-white overflow-x-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-4">
                        {groups.map((group) => (
                            <div key={group.title} className="space-y-1.5">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 pb-1 border-b border-slate-100">
                                    {group.title}
                                </h4>
                                <div className="divide-y divide-slate-50">
                                    {group.fields.map((f) => {
                                        let displayVal = ''
                                        if (!f.varies) {
                                            displayVal = withUnit(formatValue(f.value), f.unit)
                                        } else if (f.min !== undefined && f.max !== undefined) {
                                            displayVal = withUnit(
                                                `${formatValue(f.min)}–${formatValue(f.max)}`,
                                                f.unit
                                            )
                                        } else if (Array.isArray(f.values)) {
                                            displayVal = f.values.map(formatValue).join(', ')
                                        } else {
                                            displayVal = 'varies'
                                        }

                                        return (
                                            <div
                                                key={f.key || f.label}
                                                className="flex items-baseline justify-between py-1 text-xs gap-2"
                                            >
                                                <span className="text-slate-600 truncate" title={f.label}>
                                                    {f.label}
                                                </span>
                                                <div className="text-right flex items-center gap-1.5 shrink-0">
                                                    <span
                                                        className={`font-medium tabular-nums ${
                                                            f.varies ? 'text-blue-700 font-semibold' : 'text-slate-900'
                                                        }`}
                                                    >
                                                        {displayVal}
                                                    </span>
                                                    {f.varies && f.distinct !== undefined && (
                                                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200">
                                                            {f.distinct}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
