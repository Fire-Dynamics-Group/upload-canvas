import React, { useState, useMemo, useRef } from 'react'
import { MATERIAL_B_VALUES } from '@/utils/teqReliabilityConstants'

// Standard Eurocode 1 thermal inertia default values [J/(m²s½K)]
const DEFAULT_B_VALUES = {
    plasterboard: 421,
    brick: 1675,
    concrete: 1742,
}

// Shoelace formula to compute polygon area in m²
function computePolygonArea(pts = []) {
    if (pts.length < 3) return 0
    let area = 0
    for (let i = 0; i < pts.length - 1; i++) {
        area += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y
    }
    return Math.abs(area) / 2
}

export default function CompartmentMiniMap({
    geoPoints = [],
    inputs = {},
    onInputsChange = () => {},
    selectedMacsRun = null,
    onOpenCanvas = null,
}) {
    const [hoveredWall, setHoveredWall] = useState(null)
    const [hoveredOpening, setHoveredOpening] = useState(null)
    const [customBInputs, setCustomBInputs] = useState({})
    const materialSelectRefs = useRef({})
    const openingInputRefs = useRef({})

    // 1. Extract obstruction polygon & opening segments from geoPoints
    const { walls, openings, floorArea, bbox } = useMemo(() => {
        const obstruction = geoPoints.find((el) => el.comments === 'obstruction')
        const pts = obstruction?.finalPoints || []
        const rawOpenings = geoPoints.filter((el) => el.comments === 'opening')

        const parsedWalls = []
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

        if (pts.length >= 2) {
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i]
                if (p.x < minX) minX = p.x
                if (p.x > maxX) maxX = p.x
                if (p.y < minY) minY = p.y
                if (p.y > maxY) maxY = p.y
            }

            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i]
                const p2 = pts[i + 1]
                const length = Math.hypot(p2.x - p1.x, p2.y - p1.y)
                parsedWalls.push({
                    index: i,
                    label: `W${i + 1}`,
                    name: `Wall ${i + 1}`,
                    p1,
                    p2,
                    midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
                    length: Math.round(length * 10) / 10,
                })
            }
        }

        const parsedOpenings = rawOpenings.map((op, idx) => {
            const fpts = op.finalPoints || []
            const p1 = fpts[0] || { x: 0, y: 0 }
            const p2 = fpts[fpts.length - 1] || p1
            const width = Math.hypot(p2.x - p1.x, p2.y - p1.y)
            return {
                index: idx,
                label: `O${idx + 1}`,
                p1,
                p2,
                midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
                width: Math.round(width * 10) / 10,
            }
        })

        const area = computePolygonArea(pts)

        return {
            walls: parsedWalls,
            openings: parsedOpenings,
            floorArea: area > 0 ? area : 60, // fallback 60m²
            bbox: {
                minX: minX === Infinity ? 0 : minX,
                maxX: maxX === -Infinity ? 10 : maxX,
                minY: minY === Infinity ? 0 : minY,
                maxY: maxY === -Infinity ? 6 : maxY,
            },
        }
    }, [geoPoints])

    const compartmentHeight = Number(inputs.compartmentHeight) || 3.15

    // 2. Map current inputs to per-wall properties
    const wallMaterials = useMemo(() => {
        const rawProps = inputs.wallProperties || []
        return walls.map((w, idx) => {
            const mat = rawProps[idx] || 'plasterboard'
            return mat
        })
    }, [walls, inputs.wallProperties])

    // Opening heights (default 2.0m per opening if not set)
    const openingHeights = useMemo(() => {
        const rawHeights = inputs.openingHeights || []
        return openings.map((op, idx) => {
            const h = rawHeights[idx] !== undefined ? Number(rawHeights[idx]) : 2.0
            return h
        })
    }, [openings, inputs.openingHeights])

    const slabMaterial = (inputs.floorAndCeilingMaterials && inputs.floorAndCeilingMaterials[0]) || 'concrete'

    // Ventilation geometry: total area Av and weighted average height Heq
    const ventStats = useMemo(() => {
        let totalAv = 0
        let weightedHSum = 0
        openings.forEach((op, idx) => {
            const h = openingHeights[idx] !== undefined ? openingHeights[idx] : 2.0
            const area = op.width * h
            totalAv += area
            weightedHSum += area * h
        })
        const heq = totalAv > 0 ? weightedHSum / totalAv : 0
        return {
            totalAv: Math.round(totalAv * 10) / 10,
            heq: Math.round(heq * 10) / 10,
        }
    }, [openings, openingHeights])

    // Helper to get thermal inertia b for a given material string or custom value
    const getBForMaterial = (mat, wallIdx = null) => {
        if (mat === 'custom') {
            if (wallIdx !== null && customBInputs[wallIdx] !== undefined) {
                return Number(customBInputs[wallIdx]) || 1200
            }
            if (inputs.customBValue) return Number(inputs.customBValue) || 1200
            return 1200
        }
        return DEFAULT_B_VALUES[mat] || (MATERIAL_B_VALUES && MATERIAL_B_VALUES[mat]) || 1742
    }

    // 3. Calculate live composite weighted b-value
    const compositeB = useMemo(() => {
        if (inputs.customBValue && inputs.customBValue !== '') {
            return Number(inputs.customBValue)
        }
        const slabArea = 2 * floorArea
        const slabB = getBForMaterial(slabMaterial)
        let totalWeightedB = slabArea * slabB
        let totalArea = slabArea

        walls.forEach((w, idx) => {
            const area = w.length * compartmentHeight
            const mat = wallMaterials[idx]
            const b = getBForMaterial(mat, idx)
            totalWeightedB += area * b
            totalArea += area
        })

        return totalArea > 0 ? Math.round(totalWeightedB / totalArea) : 1742
    }, [floorArea, slabMaterial, walls, wallMaterials, customBInputs, inputs.customBValue, compartmentHeight])

    // Update individual wall material
    const handleWallMaterialChange = (wallIndex, newMat) => {
        const next = [...wallMaterials]
        next[wallIndex] = newMat
        onInputsChange('wallProperties', next)
    }

    // Update custom b value for a specific wall
    const handleCustomBChange = (wallIndex, val) => {
        setCustomBInputs((prev) => ({ ...prev, [wallIndex]: val }))
        // Also update wallProperties to ensure backend sync
        const next = [...wallMaterials]
        next[wallIndex] = 'custom'
        onInputsChange('wallProperties', next)
    }

    // Update slab material (floor & ceiling)
    const handleSlabMaterialChange = (newMat) => {
        onInputsChange('floorAndCeilingMaterials', [newMat, newMat])
    }

    // Update opening height (m)
    const handleOpeningHeightChange = (idx, val) => {
        const next = [...openingHeights]
        next[idx] = Number(val) || 0
        onInputsChange('openingHeights', next)
    }

    // 1-Click Presets
    const handleApplyPreset = (presetType) => {
        if (presetType === 'standard') {
            onInputsChange('floorAndCeilingMaterials', ['concrete', 'concrete'])
            onInputsChange('wallProperties', walls.map(() => 'plasterboard'))
            onInputsChange('customBValue', '')
        } else if (presetType === 'masonry') {
            onInputsChange('floorAndCeilingMaterials', ['concrete', 'concrete'])
            onInputsChange('wallProperties', walls.map(() => 'brick'))
            onInputsChange('customBValue', '')
        } else if (presetType === 'concrete') {
            onInputsChange('floorAndCeilingMaterials', ['concrete', 'concrete'])
            onInputsChange('wallProperties', walls.map(() => 'concrete'))
            onInputsChange('customBValue', '')
        }
    }

    // SVG Projection setup
    const svgWidth = 480
    const svgHeight = 280
    const pad = 36
    const geoW = Math.max(1, bbox.maxX - bbox.minX)
    const geoH = Math.max(1, bbox.maxY - bbox.minY)
    const scale = Math.min((svgWidth - 2 * pad) / geoW, (svgHeight - 2 * pad) / geoH)
    const offsetX = (svgWidth - geoW * scale) / 2
    const offsetY = (svgHeight - geoH * scale) / 2

    const toSvgX = (x) => offsetX + (x - bbox.minX) * scale
    const toSvgY = (y) => offsetY + (bbox.maxY - y) * scale // invert Y so North is up



    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left 7 Columns: Interactive SVG Vector Mini-Map */}
                <div className="lg:col-span-7 bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col justify-between select-none">
                    <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800">
                        <span className="font-bold flex items-center gap-1.5 text-slate-200 text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Interactive Plan & Boundary HUD
                        </span>
                        <div className="flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block"></span>
                                Wall (W1–W{walls.length})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded bg-cyan-400 inline-block"></span>
                                Opening (O1–O{openings.length})
                            </span>

                        </div>
                    </div>

                    {/* SVG Vector Drawing */}
                    <div className="py-2 flex items-center justify-center relative">
                        <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="w-full h-56 max-h-64"
                        >
                            <defs>
                                <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width={svgWidth} height={svgHeight} fill="url(#minimap-grid)" />

                            {/* Polygon Room Fill */}
                            {walls.length >= 2 && (
                                <polygon
                                    points={walls.map((w) => `${toSvgX(w.p1.x)},${toSvgY(w.p1.y)}`).join(' ')}
                                    fill="#0f172a"
                                    fillOpacity="0.85"
                                    stroke="#334155"
                                    strokeWidth="1"
                                />
                            )}

                            {/* Center Room Info */}
                            <text
                                x={svgWidth / 2}
                                y={svgHeight / 2}
                                textAnchor="middle"
                                fill="#475569"
                                fontSize="12"
                                fontWeight="bold"
                            >
                                {floorArea.toFixed(1)} m² Floor
                            </text>
                            <text
                                x={svgWidth / 2}
                                y={svgHeight / 2 + 16}
                                textAnchor="middle"
                                fill="#334155"
                                fontSize="10"
                            >
                                Height: {compartmentHeight}m
                            </text>

                            {/* Wall Segments */}
                            {walls.map((w) => {
                                const isHovered = hoveredWall === w.index
                                const x1 = toSvgX(w.p1.x)
                                const y1 = toSvgY(w.p1.y)
                                const x2 = toSvgX(w.p2.x)
                                const y2 = toSvgY(w.p2.y)
                                const mat = wallMaterials[w.index]
                                const isBrick = mat === 'brick'

                                return (
                                    <line
                                        key={`wall-seg-${w.index}`}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke={isHovered ? '#f59e0b' : isBrick ? '#f97316' : '#6366f1'}
                                        strokeWidth={isHovered ? 6 : 4}
                                        strokeLinecap="round"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredWall(w.index)}
                                        onMouseLeave={() => setHoveredWall(null)}
                                        onClick={() => {
                                            setHoveredWall(w.index)
                                            materialSelectRefs.current[w.index]?.focus()
                                        }}
                                    />
                                )
                            })}



                            {/* Openings (drawn cyan on top of walls with interactive hover) */}
                            {openings.map((op) => {
                                const isHovered = hoveredOpening === op.index
                                const x1 = toSvgX(op.p1.x)
                                const y1 = toSvgY(op.p1.y)
                                const x2 = toSvgX(op.p2.x)
                                const y2 = toSvgY(op.p2.y)
                                const mx = (x1 + x2) / 2
                                const my = (y1 + y2) / 2

                                return (
                                    <g
                                        key={`op-seg-${op.index}`}
                                        className="cursor-pointer select-none"
                                        onMouseEnter={() => setHoveredOpening(op.index)}
                                        onMouseLeave={() => setHoveredOpening(null)}
                                        onClick={() => {
                                            setHoveredOpening(op.index)
                                            openingInputRefs.current[op.index]?.focus()
                                        }}
                                    >
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke={isHovered ? '#f59e0b' : '#06b6d4'}
                                            strokeWidth={isHovered ? 8 : 5}
                                            strokeLinecap="round"
                                        />
                                        <rect
                                            x={mx - (isHovered ? 16 : 14)}
                                            y={my - (isHovered ? 8 : 7)}
                                            width={isHovered ? 32 : 28}
                                            height={isHovered ? 16 : 14}
                                            rx="3"
                                            fill={isHovered ? '#f59e0b' : '#06b6d4'}
                                            stroke="#ffffff"
                                            strokeWidth={isHovered ? 1.5 : 0}
                                        />
                                        <text
                                            x={mx}
                                            y={my + 3}
                                            textAnchor="middle"
                                            fill={isHovered ? '#78350f' : '#083344'}
                                            fontSize={isHovered ? 9 : 8}
                                            fontWeight="bold"
                                        >
                                            {op.label}
                                        </text>
                                    </g>
                                )
                            })}

                            {/* Wall Badges (W1, W2...) */}
                            {walls.map((w) => {
                                const isHovered = hoveredWall === w.index
                                const mx = toSvgX(w.midpoint.x)
                                const my = toSvgY(w.midpoint.y)

                                return (
                                    <g
                                        key={`badge-${w.index}`}
                                        className="cursor-pointer select-none"
                                        transform={`translate(${mx}, ${my})`}
                                        onMouseEnter={() => setHoveredWall(w.index)}
                                        onMouseLeave={() => setHoveredWall(null)}
                                        onClick={() => {
                                            setHoveredWall(w.index)
                                            materialSelectRefs.current[w.index]?.focus()
                                        }}
                                    >
                                        <circle
                                            cx="0"
                                            cy="0"
                                            r={isHovered ? 12 : 10}
                                            fill={isHovered ? '#f59e0b' : '#4f46e5'}
                                            stroke="#ffffff"
                                            strokeWidth="1.5"
                                        />
                                        <text
                                            cx="0"
                                            cy="0"
                                            dy="3.5"
                                            textAnchor="middle"
                                            fill={isHovered ? '#78350f' : '#ffffff'}
                                            fontSize="9"
                                            fontWeight="bold"
                                        >
                                            {w.label}
                                        </text>
                                    </g>
                                )
                            })}
                        </svg>
                    </div>

                    {/* Footer HUD info */}
                    <div className="text-xs bg-slate-900/90 rounded-lg p-2 text-slate-300 border border-slate-800 flex items-center justify-between">
                        {hoveredOpening !== null && openings[hoveredOpening] ? (
                            <span className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px]">
                                <span>🎯</span>
                                <span>
                                    {openings[hoveredOpening].label}: Opening {hoveredOpening + 1} · Width: {openings[hoveredOpening].width}m · Height: {openingHeights[hoveredOpening]}m · Area: {(openings[hoveredOpening].width * openingHeights[hoveredOpening]).toFixed(1)} m²
                                </span>
                            </span>
                        ) : hoveredWall !== null && walls[hoveredWall] ? (
                            <span className="flex items-center gap-1.5 font-bold text-amber-400 text-[11px]">
                                <span>🎯</span>
                                <span>
                                    {walls[hoveredWall].label}: Length {walls[hoveredWall].length}m · Material: {wallMaterials[hoveredWall]} (b = {getBForMaterial(wallMaterials[hoveredWall], hoveredWall)})

                                </span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                <span className="text-amber-400">💡</span> Hover any wall, opening, or row to highlight boundary assignments.
                            </span>
                        )}
                        {onOpenCanvas && (
                            <button
                                type="button"
                                onClick={onOpenCanvas}
                                className="text-purple-400 hover:text-purple-300 text-[11px] font-semibold flex items-center gap-1"
                            >
                                <span>📐</span> Open 2D Canvas →
                            </button>
                        )}
                    </div>
                </div>

                {/* Right 5 Columns: Synced Wall & Opening Breakdown Table with Live Editing */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                    <div>
                        {/* Header with Live Composite b Meter */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                            <div>
                                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide block">
                                    Boundary Assignments
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    Edit materials or enter custom b-values
                                </span>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Composite:</span>
                                    <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shadow-sm">
                                        b = {compositeB.toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-[9px] text-gray-400">J/(m²s½K) weighted avg</span>
                            </div>
                        </div>

                        {/* Preset Quick-Select Toolbar */}
                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 mb-2 flex items-center justify-between gap-1 text-xs">
                            <span className="font-bold text-gray-600 text-[10px] flex items-center gap-1">
                                <span>⚡</span> Presets:
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset('standard')}
                                    className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-semibold transition-colors"
                                >
                                    Drywall + Slabs
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset('masonry')}
                                    className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-semibold transition-colors"
                                >
                                    Masonry
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset('concrete')}
                                    className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-semibold transition-colors"
                                >
                                    All Concrete
                                </button>
                            </div>
                        </div>

                        {/* Floor & Ceiling Master Row */}
                        <div className="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                                <span className="font-bold text-gray-800 block text-[11px]">
                                    Floor & Ceiling Slabs (2 × {floorArea.toFixed(1)} m²)
                                </span>
                                <span className="text-[10px] text-gray-400">Upper composite boundary</span>
                            </div>
                            <select
                                value={slabMaterial}
                                onChange={(e) => handleSlabMaterialChange(e.target.value)}
                                className="text-xs font-semibold bg-white border border-gray-300 rounded px-2 py-1 text-gray-800 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                                <option value="concrete">Concrete (1,742)</option>
                                <option value="plasterboard">Plasterboard (421)</option>
                                <option value="brick">Brick (1,675)</option>
                            </select>
                        </div>

                        {/* Wall Rows List */}
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {walls.map((w, idx) => {
                                const isHovered = hoveredWall === idx
                                const mat = wallMaterials[idx]
                                const isCustom = mat === 'custom'
                                const currentB = getBForMaterial(mat, idx)

                                // Find if this wall has an opening
                                const linkedOpening = openings.find((op) => {
                                    // Distance from opening midpoint to wall line segment
                                    const mx = op.midpoint.x
                                    const my = op.midpoint.y
                                    const d1 = Math.hypot(mx - w.p1.x, my - w.p1.y)
                                    const d2 = Math.hypot(mx - w.p2.x, my - w.p2.y)
                                    return Math.abs(d1 + d2 - w.length) < 0.8
                                })

                                return (
                                    <div
                                        key={`wall-row-${idx}`}
                                        onMouseEnter={() => setHoveredWall(idx)}
                                        onMouseLeave={() => setHoveredWall(null)}
                                        className={`p-2 rounded-lg text-xs flex items-center justify-between border transition-colors ${
                                            isHovered
                                                ? 'bg-amber-50 border-amber-400 shadow-sm'
                                                : 'bg-white border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        {/* Left: Badge + Wall Label */}
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] flex-shrink-0 ${
                                                    isHovered
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-indigo-600 text-white'
                                                }`}
                                            >
                                                {w.label}
                                            </span>
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-1.5 text-[11px]">
                                                    <span>{w.name} ({w.length}m)</span>

                                                </div>
                                                <span className="text-[10px] text-gray-400 block">
                                                    {linkedOpening ? `${linkedOpening.label}: ${linkedOpening.width}m openable` : 'Solid boundary'} · {(w.length * compartmentHeight).toFixed(1)} m²
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right: Material selector + custom input */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <select
                                                ref={(el) => (materialSelectRefs.current[idx] = el)}
                                                value={mat}
                                                onChange={(e) => handleWallMaterialChange(idx, e.target.value)}
                                                className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                                            >
                                                <option value="plasterboard">Plasterboard (421)</option>
                                                <option value="brick">Brick (1,675)</option>
                                                <option value="concrete">Concrete (1,742)</option>
                                                <option value="custom">Custom b...</option>
                                            </select>

                                            {isCustom ? (
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        type="number"
                                                        value={customBInputs[idx] !== undefined ? customBInputs[idx] : 1200}
                                                        step="25"
                                                        min="100"
                                                        max="3000"
                                                        onChange={(e) => handleCustomBChange(idx, e.target.value)}
                                                        className="w-16 text-xs text-right font-mono font-bold border border-indigo-300 bg-indigo-50/50 rounded px-1.5 py-1 text-indigo-900 focus:ring-1 focus:ring-indigo-500"
                                                        placeholder="b val"
                                                        title="Enter custom thermal inertia b"
                                                    />
                                                    <span className="text-[9px] text-gray-400 font-mono">b</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-mono text-gray-500 font-semibold w-10 text-right">
                                                    {currentB}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Openings & Ventilation Heights (from Screenshot Input: Enter Opening N Height) */}
                        {openings.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
                                        Ventilation Openings ({openings.length})
                                    </span>
                                    <span className="text-[10px] text-cyan-800 font-semibold bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded">
                                        Av = {ventStats.totalAv} m² · Heq = {ventStats.heq}m
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {openings.map((op, idx) => {
                                        const isHovered = hoveredOpening === idx
                                        return (
                                            <div
                                                key={`op-input-row-${idx}`}
                                                onMouseEnter={() => setHoveredOpening(idx)}
                                                onMouseLeave={() => setHoveredOpening(null)}
                                                className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors cursor-pointer border ${
                                                    isHovered
                                                        ? 'bg-amber-50 border-amber-400 shadow-sm'
                                                        : 'bg-cyan-50/50 border-cyan-200 hover:border-cyan-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`w-5 h-5 rounded font-bold flex items-center justify-center text-[10px] ${
                                                            isHovered ? 'bg-amber-500 text-white' : 'bg-cyan-600 text-white'
                                                        }`}
                                                    >
                                                        {op.label}
                                                    </span>
                                                    <span className="font-semibold text-gray-800 text-[11px]">
                                                        Opening {idx + 1} (Width: {op.width}m)
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <label className="text-[10px] text-gray-500 font-medium">Height (m):</label>
                                                    <input
                                                        ref={(el) => (openingInputRefs.current[idx] = el)}
                                                        type="number"
                                                        step="0.1"
                                                        min="0.2"
                                                        max="10"
                                                        value={openingHeights[idx]}
                                                        onChange={(e) => handleOpeningHeightChange(idx, e.target.value)}
                                                        className="w-14 text-xs text-right font-mono font-bold border border-cyan-300 bg-white rounded px-1.5 py-0.5 text-cyan-900 focus:ring-1 focus:ring-cyan-500"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                        <span className="text-[10px]">
                            Walls: {walls.length} · Openings: {openings.length}
                        </span>
                        <span className="text-[10px] text-gray-500">
                            Auto-syncs with Recalculate Time Eq
                        </span>
                    </div>
                </div>

            </div>
        </div>
    )
}
