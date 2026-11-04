import { useState, useMemo } from 'react'

const TEMP_COLOURS = {
    slabTop: '#2563eb',       // Blue 600
    slabBottom: '#1e3a8a',    // Blue 900
    loflTemp: '#db2777',      // Pink 600 (unprotected beam)
    meshTemp: '#16a34a',      // Green 600
    fireTemp: '#d97706',      // Amber 600
}

const CAPACITY_COLOURS = {
    slabCap: '#2563eb',       // Blue
    beamCap: '#16a34a',       // Green
    totalCap: '#0284c7',      // Sky
    factoredHot: '#dc2626',   // Red dashed
    deflection: '#9333ea',    // Purple (right axis)
}

export default function MacsCharts({ timeSeries = [], factoredHot = null, timeLimit = null }) {
    const [activeTab, setActiveTab] = useState('temperature') // 'temperature' | 'capacity'
    const [hoverIndex, setHoverIndex] = useState(null)

    const rows = Array.isArray(timeSeries) ? timeSeries : []

    // Calculate domains
    const { maxTime, maxTemp, maxCap, maxDefl } = useMemo(() => {
        if (rows.length === 0) return { maxTime: 60, maxTemp: 1000, maxCap: 500, maxDefl: 100 }
        let tMax = timeLimit || 0
        let tempMax = 0
        let capMax = factoredHot || 0
        let deflMax = 0

        for (const r of rows) {
            if (r.time_min > tMax) tMax = r.time_min
            const t = Math.max(r.fire_temp || 0, r.lofl_temp || 0, r.mesh_temp || 0, r.slabbot_temp || 0, r.slabtop_temp || 0)
            if (t > tempMax) tempMax = t
            const c = Math.max(r.slab_cap || 0, r.beam_hot_capacity || 0, r.total_plate_capacity || 0)
            if (c > capMax) capMax = c
            if ((r.deflection || 0) > deflMax) deflMax = r.deflection
        }
        return {
            maxTime: Math.max(tMax, 20),
            maxTemp: Math.ceil((tempMax + 50) / 100) * 100 || 800,
            maxCap: Math.ceil((capMax + 50) / 100) * 100 || 500,
            maxDefl: Math.ceil((deflMax + 20) / 50) * 50 || 100,
        }
    }, [rows, timeLimit, factoredHot])

    if (rows.length === 0) {
        return (
            <div className="p-6 text-center text-sm text-gray-500 italic bg-gray-50 rounded-lg border border-gray-200">
                No time-series curves available for this run.
            </div>
        )
    }

    const W = 620
    const H = 320
    const pad = { top: 25, right: 55, bottom: 45, left: 55 }
    const plotW = W - pad.left - pad.right
    const plotH = H - pad.top - pad.bottom

    const scaleX = (t) => pad.left + (t / maxTime) * plotW
    const scaleYTemp = (temp) => pad.top + plotH - (temp / maxTemp) * plotH
    const scaleYCap = (cap) => pad.top + plotH - (cap / maxCap) * plotH
    const scaleYDefl = (d) => pad.top + plotH - (d / maxDefl) * plotH

    // Build polyline points
    const pointsFire = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYTemp(r.fire_temp || 0).toFixed(1)}`).join(' ')
    const pointsBeam = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYTemp(r.lofl_temp || 0).toFixed(1)}`).join(' ')
    const pointsMesh = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYTemp(r.mesh_temp || 0).toFixed(1)}`).join(' ')
    const pointsSlabBot = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYTemp(r.slabbot_temp || 0).toFixed(1)}`).join(' ')
    const pointsSlabTop = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYTemp(r.slabtop_temp || 0).toFixed(1)}`).join(' ')

    const pointsSlabCap = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYCap(r.slab_cap || 0).toFixed(1)}`).join(' ')
    const pointsBeamCap = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYCap(r.beam_hot_capacity || 0).toFixed(1)}`).join(' ')
    const pointsTotalCap = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYCap(r.total_plate_capacity || 0).toFixed(1)}`).join(' ')
    const pointsDefl = rows.map((r) => `${scaleX(r.time_min).toFixed(1)},${scaleYDefl(r.deflection || 0).toFixed(1)}`).join(' ')

    const hoverRow = hoverIndex !== null ? rows[hoverIndex] : null

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('temperature')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                            activeTab === 'temperature'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Temperature Curves
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('capacity')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                            activeTab === 'capacity'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Capacity & Deflection
                    </button>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                    {rows.length} time steps ({rows[rows.length - 1]?.time_min?.toFixed(1) || 0} min)
                </span>
            </div>

            {/* SVG Chart */}
            <div className="relative overflow-x-auto">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full h-auto select-none font-sans"
                    onMouseLeave={() => setHoverIndex(null)}
                >
                    {/* Background grid */}
                    <rect x={pad.left} y={pad.top} width={plotW} height={plotH} fill="#fafafa" stroke="#e5e7eb" />

                    {/* Horizontal grid lines */}
                    {[0.25, 0.5, 0.75, 1.0].map((frac) => {
                        const y = pad.top + plotH * (1 - frac)
                        const valLeft = activeTab === 'temperature' ? Math.round(maxTemp * frac) : Math.round(maxCap * frac)
                        const valRight = activeTab === 'capacity' ? Math.round(maxDefl * frac) : null
                        return (
                            <g key={frac}>
                                <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
                                <text x={pad.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-500 font-mono">
                                    {valLeft}
                                </text>
                                {valRight !== null && (
                                    <text x={pad.left + plotW + 8} y={y + 4} textAnchor="start" className="text-[10px] fill-purple-700 font-mono">
                                        {valRight}
                                    </text>
                                )}
                            </g>
                        )
                    })}

                    {/* Vertical grid lines (Time) */}
                    {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                        const x = pad.left + plotW * frac
                        const tVal = Math.round(maxTime * frac)
                        return (
                            <g key={frac}>
                                <line x1={x} y1={pad.top} x2={x} y2={pad.top + plotH} stroke="#e5e7eb" strokeDasharray="3 3" />
                                <text x={x} y={pad.top + plotH + 16} textAnchor="middle" className="text-[10px] fill-gray-500 font-mono">
                                    {tVal}
                                </text>
                            </g>
                        )
                    })}

                    {/* Axis Labels */}
                    <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle" className="text-[11px] font-medium fill-gray-700">
                        Fire Duration (minutes)
                    </text>
                    <text
                        x={12}
                        y={pad.top + plotH / 2}
                        textAnchor="middle"
                        transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
                        className="text-[11px] font-medium fill-gray-700"
                    >
                        {activeTab === 'temperature' ? 'Temperature (°C)' : 'Capacity (kNm)'}
                    </text>
                    {activeTab === 'capacity' && (
                        <text
                            x={W - 10}
                            y={pad.top + plotH / 2}
                            textAnchor="middle"
                            transform={`rotate(90 ${W - 10} ${pad.top + plotH / 2})`}
                            className="text-[11px] font-medium fill-purple-700"
                        >
                            Deflection (mm)
                        </text>
                    )}

                    {/* Curves */}
                    {activeTab === 'temperature' ? (
                        <>
                            <polyline fill="none" stroke={TEMP_COLOURS.fireTemp} strokeWidth="2" points={pointsFire} />
                            <polyline fill="none" stroke={TEMP_COLOURS.loflTemp} strokeWidth="2.2" points={pointsBeam} />
                            <polyline fill="none" stroke={TEMP_COLOURS.meshTemp} strokeWidth="1.8" points={pointsMesh} />
                            <polyline fill="none" stroke={TEMP_COLOURS.slabBottom} strokeWidth="1.8" points={pointsSlabBot} />
                            <polyline fill="none" stroke={TEMP_COLOURS.slabTop} strokeWidth="1.8" points={pointsSlabTop} />
                        </>
                    ) : (
                        <>
                            {factoredHot && (
                                <line
                                    x1={pad.left}
                                    y1={scaleYCap(factoredHot)}
                                    x2={pad.left + plotW}
                                    y2={scaleYCap(factoredHot)}
                                    stroke={CAPACITY_COLOURS.factoredHot}
                                    strokeWidth="1.8"
                                    strokeDasharray="5 3"
                                />
                            )}
                            <polyline fill="none" stroke={CAPACITY_COLOURS.slabCap} strokeWidth="1.8" points={pointsSlabCap} />
                            <polyline fill="none" stroke={CAPACITY_COLOURS.beamCap} strokeWidth="1.8" points={pointsBeamCap} />
                            <polyline fill="none" stroke={CAPACITY_COLOURS.totalCap} strokeWidth="2.2" points={pointsTotalCap} />
                            <polyline fill="none" stroke={CAPACITY_COLOURS.deflection} strokeWidth="2" strokeDasharray="4 2" points={pointsDefl} />
                        </>
                    )}

                    {/* Interactive hover line */}
                    {hoverIndex !== null && hoverRow && (
                        <line
                            x1={scaleX(hoverRow.time_min)}
                            y1={pad.top}
                            x2={scaleX(hoverRow.time_min)}
                            y2={pad.top + plotH}
                            stroke="#475569"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                        />
                    )}

                    {/* Invisible overlay for mouse interaction */}
                    <rect
                        x={pad.left}
                        y={pad.top}
                        width={plotW}
                        height={plotH}
                        fill="transparent"
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const mouseX = e.clientX - rect.left
                            const tHover = (mouseX / plotW) * maxTime
                            // Find closest row
                            let bestIdx = 0
                            let minDiff = 999999
                            rows.forEach((r, idx) => {
                                const diff = Math.abs(r.time_min - tHover)
                                if (diff < minDiff) {
                                    minDiff = diff
                                    bestIdx = idx
                                }
                            })
                            setHoverIndex(bestIdx)
                        }}
                    />
                </svg>
            </div>

            {/* Hover tooltip metrics */}
            {hoverRow && (
                <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-2 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                    <span className="font-semibold text-slate-800">t = {hoverRow.time_min.toFixed(1)} min:</span>
                    {activeTab === 'temperature' ? (
                        <>
                            <span style={{ color: TEMP_COLOURS.fireTemp }}>Fire: {hoverRow.fire_temp?.toFixed(0)}°C</span>
                            <span style={{ color: TEMP_COLOURS.loflTemp }}>Beam: {hoverRow.lofl_temp?.toFixed(0)}°C</span>
                            <span style={{ color: TEMP_COLOURS.meshTemp }}>Mesh: {hoverRow.mesh_temp?.toFixed(0)}°C</span>
                            <span style={{ color: TEMP_COLOURS.slabBottom }}>Slab Bot: {hoverRow.slabbot_temp?.toFixed(0)}°C</span>
                            <span style={{ color: TEMP_COLOURS.slabTop }}>Slab Top: {hoverRow.slabtop_temp?.toFixed(0)}°C</span>
                        </>
                    ) : (
                        <>
                            <span style={{ color: CAPACITY_COLOURS.totalCap }}>Total Cap: {hoverRow.total_plate_capacity?.toFixed(1)} kNm</span>
                            <span style={{ color: CAPACITY_COLOURS.beamCap }}>Beam Cap: {hoverRow.beam_hot_capacity?.toFixed(1)} kNm</span>
                            <span style={{ color: CAPACITY_COLOURS.slabCap }}>Slab Cap: {hoverRow.slab_cap?.toFixed(1)} kNm</span>
                            {factoredHot && <span style={{ color: CAPACITY_COLOURS.factoredHot }}>Load: {factoredHot.toFixed(1)}</span>}
                            <span style={{ color: CAPACITY_COLOURS.deflection }}>Deflection: {hoverRow.deflection?.toFixed(1)} mm</span>
                            <span className="text-gray-600">UF: {hoverRow.utilization_factor?.toFixed(2)}</span>
                        </>
                    )}
                </div>
            )}

            {/* Legends */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-gray-700">
                {activeTab === 'temperature' ? (
                    <>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: TEMP_COLOURS.fireTemp }} />
                            <span>Fire</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: TEMP_COLOURS.loflTemp }} />
                            <span>Unprotected beam</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: TEMP_COLOURS.meshTemp }} />
                            <span>Mesh</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: TEMP_COLOURS.slabBottom }} />
                            <span>Slab bottom</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: TEMP_COLOURS.slabTop }} />
                            <span>Slab top</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: CAPACITY_COLOURS.totalCap }} />
                            <span>Total capacity</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: CAPACITY_COLOURS.beamCap }} />
                            <span>Beam capacity</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: CAPACITY_COLOURS.slabCap }} />
                            <span>Slab capacity</span>
                        </div>
                        {factoredHot && (
                            <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-0.5 border-t-2 border-dashed border-red-600" />
                                <span>Factored load</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-purple-600" />
                            <span>Deflection (right axis)</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
