import { useState, useMemo } from 'react'

export default function MacsMonteCarloCharts({
    distributions = {},
    scatter = [],
    batchId = '',
    onSelectRun = null,
}) {
    const [viewMode, setViewMode] = useState('grid') // 'grid' | 'scatter' | 'capacity' | 'lofl' | 'mesh'
    const [hoverPoint, setHoverPoint] = useState(null)

    const distCap = distributions.total_plate_capacity || {}
    const distLofl = distributions.lofl_temp || {}
    const distMesh = distributions.mesh_temp || {}

    // Scatter bounds
    const scatterBounds = useMemo(() => {
        if (!scatter || scatter.length === 0) return { minQf: 0, maxQf: 1500, minWin: 0, maxWin: 100 }
        let minQ = Infinity, maxQ = -Infinity, minW = Infinity, maxW = -Infinity
        for (const p of scatter) {
            if (p.qf != null) {
                if (p.qf < minQ) minQ = p.qf
                if (p.qf > maxQ) maxQ = p.qf
            }
            if (p.window_percent != null) {
                if (p.window_percent < minW) minW = p.window_percent
                if (p.window_percent > maxW) maxW = p.window_percent
            }
        }
        return {
            minQf: Math.floor(Math.max(0, minQ - 50)),
            maxQf: Math.ceil((maxQ + 100) / 100) * 100,
            minWin: 0,
            maxWin: 100,
        }
    }, [scatter])

    // Capacity bounds
    const capBounds = useMemo(() => {
        const avg = distCap.average || []
        const spg = distCap.spaghetti || []
        let maxC = distCap.factored_hot_max || 10
        for (const pt of avg) {
            if (pt[1] > maxC) maxC = pt[1]
        }
        for (const s of spg.slice(0, 30)) {
            for (const pt of s.points || []) {
                if (pt[1] > maxC) maxC = pt[1]
            }
        }
        return { maxTime: 60, maxCap: Math.ceil((maxC + 5) / 5) * 5 }
    }, [distCap])

    // Temp bounds
    const loflBounds = useMemo(() => {
        return { maxTime: 60, maxTemp: 1000 }
    }, [])

    const meshBounds = useMemo(() => {
        return { maxTime: 60, maxTemp: 700 }
    }, [])

    // Dimensions
    const W = 460
    const H = 260
    const pad = { top: 20, right: 30, bottom: 40, left: 55 }
    const plotW = W - pad.left - pad.right
    const plotH = H - pad.top - pad.bottom

    // Scales
    const scaleXTime = (t, maxT = 60) => pad.left + (t / maxT) * plotW
    const scaleYVal = (v, maxV) => pad.top + plotH - (v / maxV) * plotH

    const scaleXScatter = (qf) => pad.left + ((qf - scatterBounds.minQf) / (scatterBounds.maxQf - scatterBounds.minQf)) * plotW
    const scaleYScatter = (win) => pad.top + plotH - (win / 100) * plotH

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
            {/* Header & Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <span>MACS+ Monte Carlo Simulation Output Summary</span>
                        <span className="text-[11px] font-normal normal-case text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            4 Core Analytical Charts
                        </span>
                    </h3>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs font-semibold">
                    <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                            viewMode === 'grid' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        2×2 Grid
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('scatter')}
                        className={`px-2 py-1 rounded transition-colors ${
                            viewMode === 'scatter' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Fire vs Glazing
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('capacity')}
                        className={`px-2 py-1 rounded transition-colors ${
                            viewMode === 'capacity' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Total Capacity
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('lofl')}
                        className={`px-2 py-1 rounded transition-colors ${
                            viewMode === 'lofl' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Beam Temp
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('mesh')}
                        className={`px-2 py-1 rounded transition-colors ${
                            viewMode === 'mesh' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Mesh Temp
                    </button>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* 1. Fire Load Density vs Glazing Breakage */}
                {(viewMode === 'grid' || viewMode === 'scatter') && (
                    <div className="border border-slate-200 rounded-md p-3 bg-white shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Fire Load Density vs Glazing Breakage
                            </h4>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                                    <span>Pass (UF ≤ 1.0)</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rotate-45 bg-rose-600 inline-block" />
                                    <span>Fail (UF &gt; 1.0)</span>
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                                {/* Grid lines */}
                                {[0, 25, 50, 75, 100].map((w) => (
                                    <g key={w}>
                                        <line
                                            x1={pad.left}
                                            x2={W - pad.right}
                                            y1={scaleYScatter(w)}
                                            y2={scaleYScatter(w)}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={pad.left - 6}
                                            y={scaleYScatter(w) + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {w}%
                                        </text>
                                    </g>
                                ))}
                                {[400, 800, 1200].map((q) => (
                                    <g key={q}>
                                        <line
                                            x1={scaleXScatter(q)}
                                            x2={scaleXScatter(q)}
                                            y1={pad.top}
                                            y2={pad.top + plotH}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={scaleXScatter(q)}
                                            y={pad.top + plotH + 16}
                                            textAnchor="middle"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {q}
                                        </text>
                                    </g>
                                ))}

                                {/* Axes */}
                                <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />
                                <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />

                                {/* Axis Titles */}
                                <text
                                    x={pad.left + plotW / 2}
                                    y={H - 8}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#64748b"
                                    className="font-medium"
                                >
                                    Fire Load Density qf (MJ/m²)
                                </text>
                                <text
                                    x={-(pad.top + plotH / 2)}
                                    y={16}
                                    transform="rotate(-90)"
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#64748b"
                                    className="font-medium"
                                >
                                    Glazing Breakage (%)
                                </text>

                                {/* Scatter points */}
                                {scatter.map((pt, idx) => {
                                    if (pt.qf == null || pt.window_percent == null) return null
                                    const cx = scaleXScatter(pt.qf)
                                    const cy = scaleYScatter(pt.window_percent)
                                    const isFail = !pt.pass

                                    return (
                                        <circle
                                            key={idx}
                                            cx={cx}
                                            cy={cy}
                                            r={isFail ? 5 : 2}
                                            fill={isFail ? '#dc2626' : '#10b981'}
                                            stroke={isFail ? '#ffffff' : 'none'}
                                            strokeWidth={isFail ? 1.5 : 0}
                                            opacity={isFail ? 1 : 0.45}
                                            className="cursor-pointer transition-all hover:r-4 hover:opacity-100"
                                            onMouseEnter={() => setHoverPoint({ ...pt, chart: 'scatter' })}
                                            onMouseLeave={() => setHoverPoint(null)}
                                            onClick={() => onSelectRun && onSelectRun(pt.run_id)}
                                        />
                                    )
                                })}
                            </svg>

                            {hoverPoint && hoverPoint.chart === 'scatter' && (
                                <div className="absolute top-2 right-2 bg-slate-900/90 text-white text-[11px] p-2 rounded shadow-md pointer-events-none">
                                    <div className="font-bold">Run #{hoverPoint.run_id}</div>
                                    <div>qf: {hoverPoint.qf} MJ/m²</div>
                                    <div>Glazing: {hoverPoint.window_percent}%</div>
                                    <div>UF: {hoverPoint.uf_max} ({hoverPoint.pass ? 'Pass' : 'Fail'})</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Total Capacity Distribution */}
                {(viewMode === 'grid' || viewMode === 'capacity') && (
                    <div className="border border-slate-200 rounded-md p-3 bg-white shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Total Capacity Distribution
                            </h4>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-0.5 bg-blue-700 inline-block" />
                                    <span>Average</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-0.5 bg-rose-600 border-b border-dashed border-rose-600 inline-block" />
                                    <span>Factored Hot ({distCap.factored_hot_min || 7.08})</span>
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                                {/* Grid lines */}
                                {[0, 10, 20, 30, 40].map((c) => (
                                    <g key={c}>
                                        <line
                                            x1={pad.left}
                                            x2={W - pad.right}
                                            y1={scaleYVal(c, capBounds.maxCap)}
                                            y2={scaleYVal(c, capBounds.maxCap)}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={pad.left - 6}
                                            y={scaleYVal(c, capBounds.maxCap) + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {c}
                                        </text>
                                    </g>
                                ))}
                                {[0, 15, 30, 45, 60].map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={scaleXTime(t)}
                                            x2={scaleXTime(t)}
                                            y1={pad.top}
                                            y2={pad.top + plotH}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={scaleXTime(t)}
                                            y={pad.top + plotH + 16}
                                            textAnchor="middle"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {t}
                                        </text>
                                    </g>
                                ))}

                                {/* Axes */}
                                <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />
                                <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />

                                {/* Axis Titles */}
                                <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Time (min)
                                </text>
                                <text x={-(pad.top + plotH / 2)} y={16} transform="rotate(-90)" textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Total Slab Capacity (kN/m²)
                                </text>

                                {/* Spaghetti runs */}
                                {(distCap.spaghetti || []).slice(0, 80).map((s, idx) => {
                                    const pts = (s.points || [])
                                        .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], capBounds.maxCap).toFixed(1)}`)
                                        .join(' ')
                                    return (
                                        <polyline
                                            key={idx}
                                            points={pts}
                                            fill="none"
                                            stroke="#93c5fd"
                                            strokeWidth="0.8"
                                            opacity="0.35"
                                        />
                                    )
                                })}

                                {/* Factored hot load threshold line */}
                                {distCap.factored_hot_min && (
                                    <line
                                        x1={pad.left}
                                        x2={W - pad.right}
                                        y1={scaleYVal(distCap.factored_hot_min, capBounds.maxCap)}
                                        y2={scaleYVal(distCap.factored_hot_min, capBounds.maxCap)}
                                        stroke="#dc2626"
                                        strokeWidth="1.5"
                                        strokeDasharray="4,3"
                                    />
                                )}

                                {/* Average line */}
                                {distCap.average && distCap.average.length > 0 && (
                                    <polyline
                                        points={distCap.average
                                            .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], capBounds.maxCap).toFixed(1)}`)
                                            .join(' ')}
                                        fill="none"
                                        stroke="#1d4ed8"
                                        strokeWidth="2.5"
                                    />
                                )}
                            </svg>
                        </div>
                    </div>
                )}

                {/* 3. Unprotected Beam Temperature Distribution */}
                {(viewMode === 'grid' || viewMode === 'lofl') && (
                    <div className="border border-slate-200 rounded-md p-3 bg-white shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Unprotected Beam Temperature Distribution
                            </h4>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-0.5 bg-pink-600 inline-block" />
                                    <span>Average Temp</span>
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                                {/* Grid lines */}
                                {[0, 250, 500, 750, 1000].map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={pad.left}
                                            x2={W - pad.right}
                                            y1={scaleYVal(t, loflBounds.maxTemp)}
                                            y2={scaleYVal(t, loflBounds.maxTemp)}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={pad.left - 6}
                                            y={scaleYVal(t, loflBounds.maxTemp) + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {t}°
                                        </text>
                                    </g>
                                ))}
                                {[0, 15, 30, 45, 60].map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={scaleXTime(t)}
                                            x2={scaleXTime(t)}
                                            y1={pad.top}
                                            y2={pad.top + plotH}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={scaleXTime(t)}
                                            y={pad.top + plotH + 16}
                                            textAnchor="middle"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {t}
                                        </text>
                                    </g>
                                ))}

                                {/* Axes */}
                                <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />
                                <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />

                                {/* Axis Titles */}
                                <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Time (min)
                                </text>
                                <text x={-(pad.top + plotH / 2)} y={16} transform="rotate(-90)" textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Temperature (°C)
                                </text>

                                {/* Spaghetti runs */}
                                {(distLofl.spaghetti || []).slice(0, 80).map((s, idx) => {
                                    const pts = (s.points || [])
                                        .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], loflBounds.maxTemp).toFixed(1)}`)
                                        .join(' ')
                                    return (
                                        <polyline
                                            key={idx}
                                            points={pts}
                                            fill="none"
                                            stroke="#f472b6"
                                            strokeWidth="0.8"
                                            opacity="0.35"
                                        />
                                    )
                                })}

                                {/* Average line */}
                                {distLofl.average && distLofl.average.length > 0 && (
                                    <polyline
                                        points={distLofl.average
                                            .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], loflBounds.maxTemp).toFixed(1)}`)
                                            .join(' ')}
                                        fill="none"
                                        stroke="#db2777"
                                        strokeWidth="2.5"
                                    />
                                )}
                            </svg>
                        </div>
                    </div>
                )}

                {/* 4. Reinforcement Bar Temperature Distribution */}
                {(viewMode === 'grid' || viewMode === 'mesh') && (
                    <div className="border border-slate-200 rounded-md p-3 bg-white shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Reinforcement Bar Temperature Distribution
                            </h4>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                                    <span>Average Temp</span>
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                                {/* Grid lines */}
                                {[0, 175, 350, 525, 700].map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={pad.left}
                                            x2={W - pad.right}
                                            y1={scaleYVal(t, meshBounds.maxTemp)}
                                            y2={scaleYVal(t, meshBounds.maxTemp)}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={pad.left - 6}
                                            y={scaleYVal(t, meshBounds.maxTemp) + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {t}°
                                        </text>
                                    </g>
                                ))}
                                {[0, 15, 30, 45, 60].map((t) => (
                                    <g key={t}>
                                        <line
                                            x1={scaleXTime(t)}
                                            x2={scaleXTime(t)}
                                            y1={pad.top}
                                            y2={pad.top + plotH}
                                            stroke="#f1f5f9"
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={scaleXTime(t)}
                                            y={pad.top + plotH + 16}
                                            textAnchor="middle"
                                            fontSize="9"
                                            fill="#94a3b8"
                                            className="font-mono"
                                        >
                                            {t}
                                        </text>
                                    </g>
                                ))}

                                {/* Axes */}
                                <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />
                                <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth="1" />

                                {/* Axis Titles */}
                                <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Time (min)
                                </text>
                                <text x={-(pad.top + plotH / 2)} y={16} transform="rotate(-90)" textAnchor="middle" fontSize="10" fill="#64748b" className="font-medium">
                                    Temperature (°C)
                                </text>

                                {/* Spaghetti runs */}
                                {(distMesh.spaghetti || []).slice(0, 80).map((s, idx) => {
                                    const pts = (s.points || [])
                                        .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], meshBounds.maxTemp).toFixed(1)}`)
                                        .join(' ')
                                    return (
                                        <polyline
                                            key={idx}
                                            points={pts}
                                            fill="none"
                                            stroke="#86efac"
                                            strokeWidth="0.8"
                                            opacity="0.35"
                                        />
                                    )
                                })}

                                {/* Average line */}
                                {distMesh.average && distMesh.average.length > 0 && (
                                    <polyline
                                        points={distMesh.average
                                            .map((p) => `${scaleXTime(p[0]).toFixed(1)},${scaleYVal(p[1], meshBounds.maxTemp).toFixed(1)}`)
                                            .join(' ')}
                                        fill="none"
                                        stroke="#16a34a"
                                        strokeWidth="2.5"
                                    />
                                )}
                            </svg>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
