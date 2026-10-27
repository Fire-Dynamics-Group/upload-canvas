import { useRef, useState } from 'react'
import useStore from '../store/useStore'
import { getSyncedFloors } from '../utils/multiFloorFds'

function syncedFloorCount(state) {
    return getSyncedFloors(state).length
}

function addNewFloor(onSwitchFloor) {
    const prevIdx = useStore.getState().activeFloorIndex ?? 0
    useStore.getState().addFloor()
    const nextIdx = useStore.getState().activeFloorIndex
    if (onSwitchFloor) {
        onSwitchFloor(nextIdx, { isNew: true, prevIndex: prevIdx })
    }
    return nextIdx
}

/** Quiet + Floor in the project cluster. Visible only while there is a single floor. */
export function AddFloorClusterButton({ onSwitchFloor }) {
    const currentMode = useStore((s) => s.currentMode)
    const viewMode = useStore((s) => s.viewMode)
    const floorCount = useStore((s) => syncedFloorCount(s))

    if (currentMode !== 'fdsGen' || viewMode !== '2d' || floorCount > 1) return null

    return (
        <button
            type="button"
            data-testid="add-floor-cluster-button"
            onClick={() => addNewFloor(onSwitchFloor)}
            className="text-white bg-gray-700 hover:bg-gray-600 font-medium rounded-lg text-sm px-4 py-2"
            title="Add a second floor plan"
        >
            + Floor
        </button>
    )
}

export default function FloorBar({ onSwitchFloor, onUploadFloorPdf, onReuseGroundFloorPdf }) {
    const currentMode = useStore((s) => s.currentMode)
    const viewMode = useStore((s) => s.viewMode)
    const floorsRaw = useStore((s) => s.floors)
    const activeFloorIndex = useStore((s) => s.activeFloorIndex)
    const fireFloorZ = useStore((s) => s.fireFloorZ)
    const wallHeight = useStore((s) => s.wallHeight)
    const originPixels = useStore((s) => s.originPixels)
    const pixelsPerMesh = useStore((s) => s.pixelsPerMesh)
    const elements = useStore((s) => s.elements)
    const tool = useStore((s) => s.tool)
    const comment = useStore((s) => s.comment)
    const showGhostFloorBelow = useStore((s) => s.showGhostFloorBelow)

    const setTool = useStore((s) => s.setTool)
    const setComment = useStore((s) => s.setComment)
    const setOriginPixels = useStore((s) => s.setOriginPixels)
    const setShowGhostFloorBelow = useStore((s) => s.setShowGhostFloorBelow)
    const updateFloorMeta = useStore((s) => s.updateFloorMeta)
    const removeFloor = useStore((s) => s.removeFloor)

    const [configOpen, setConfigOpen] = useState(false)
    const fileInputRef = useRef(null)

    if (currentMode !== 'fdsGen' || viewMode !== '2d') return null

    const floors = getSyncedFloors({
        floors: floorsRaw,
        activeFloorIndex,
        fireFloorZ,
        wallHeight,
        originPixels,
        pixelsPerMesh,
        elements,
    })

    if (floors.length <= 1) return null

    const activeIdx = Math.min(Math.max(0, activeFloorIndex ?? 0), floors.length - 1)
    const activeFloor = floors[activeIdx] || floors[0]

    const handleTabClick = (idx) => {
        if (idx === activeIdx) {
            setConfigOpen((v) => !v)
            return
        }
        const prevIdx = activeIdx
        useStore.getState().setActiveFloor(idx)
        if (onSwitchFloor) {
            onSwitchFloor(idx, { prevIndex: prevIdx })
        }
    }

    const handleAddFloor = () => {
        addNewFloor(onSwitchFloor)
        setConfigOpen(true)
    }

    const handleDeleteFloor = () => {
        if (floors.length <= 1) return
        const name = activeFloor?.name || `Floor ${activeIdx}`
        if (!window.confirm(`Delete "${name}" and all elements drawn on it?`)) return
        removeFloor(activeIdx)
        const nextIdx = useStore.getState().activeFloorIndex
        if (onSwitchFloor) {
            onSwitchFloor(nextIdx)
        }
    }

    const handlePdfInputChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (onUploadFloorPdf) {
            await onUploadFloorPdf(file, activeIdx)
        }
        e.target.value = ''
    }

    const isOriginTool = tool === 'origin'
    const isFloorOpeningTool = tool === 'rect' && comment === 'floorOpening'

    return (
        <div
            data-testid="floor-bar"
            className="fixed top-2 left-2 z-50 flex flex-col gap-1.5 max-w-[calc(100vw-240px)]"
        >
            {/* Primary Floor Tabs Pill */}
            <div className="flex flex-wrap items-center gap-1 bg-gray-900/95 text-white px-2 py-1.5 rounded-lg shadow-lg border border-gray-700 backdrop-blur-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1.5">
                    Levels
                </span>

                {floors.map((floor, idx) => {
                    const isActive = idx === activeIdx
                    const zVal = Number(floor.z_level ?? 0)
                    const count = (floor.elements || []).length
                    return (
                        <button
                            key={floor.floor_number ?? idx}
                            type="button"
                            data-testid={`floor-tab-${idx}`}
                            onClick={() => handleTabClick(idx)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/50'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 hover:border-gray-500'
                            }`}
                            title={isActive ? 'Current active level — click to toggle level settings' : `Click to switch view to ${floor.name}`}
                        >
                            {isActive && <span className="text-[9px] text-blue-200 font-bold">●</span>}
                            <span>{floor.name || `Floor ${idx}`}</span>
                            <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-blue-800/80 text-blue-100' : 'bg-gray-700 text-gray-400'}`}>
                                Z={zVal}m
                            </span>
                            {count > 0 && (
                                <span className="text-[10px] opacity-75">({count})</span>
                            )}
                        </button>
                    )
                })}

                <button
                    type="button"
                    data-testid="add-floor-button"
                    onClick={handleAddFloor}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                    title="Add a new floor level above"
                >
                    + Add Floor
                </button>

                <button
                    type="button"
                    data-testid="floor-settings-toggle"
                    onClick={() => setConfigOpen((v) => !v)}
                    className={`ml-1 px-2 py-1 rounded-md text-xs transition-colors ${
                        configOpen
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    title="Level settings, PDF upload & alignment tools"
                >
                    ⚙ Level Tools
                </button>

                {floors.length > 1 && (
                    <label
                        className="ml-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-750 text-[11px] text-gray-200 cursor-pointer select-none"
                        title="Show dashed outline of the adjacent floor for alignment"
                    >
                        <input
                            type="checkbox"
                            data-testid="ghost-floor-toggle"
                            checked={showGhostFloorBelow}
                            onChange={(e) => setShowGhostFloorBelow(e.target.checked)}
                            className="rounded border-gray-600 text-blue-500 focus:ring-0"
                        />
                        <span>Ghost Floor</span>
                    </label>
                )}
            </div>

            {/* Indicator banner when active upper floor is on a blank drafting sheet */}
            {activeIdx > 0 && !activeFloor.hasCustomPdf && (
                <div
                    data-testid="drafting-sheet-banner"
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-amber-950/95 text-amber-200 border border-amber-600/70 shadow-lg backdrop-blur-sm text-xs"
                >
                    <span>
                        📝 <strong>{activeFloor.name}</strong>: Blank sheet (Ghost Floor outline active). Trace over or reuse/upload a PDF.
                    </span>
                    {onReuseGroundFloorPdf && (
                        <button
                            type="button"
                            data-testid="banner-reuse-ground-pdf-button"
                            onClick={() => onReuseGroundFloorPdf(activeIdx)}
                            className="px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-700 text-white font-medium text-[11px] whitespace-nowrap transition-colors"
                            title="Reuse Ground Floor PDF background on this level"
                        >
                            📋 Use Ground Floor PDF
                        </button>
                    )}
                </div>
            )}

            {/* Expandable Active Floor Settings & Alignment Drawer */}
            {configOpen && activeFloor && (
                <div
                    data-testid="floor-config-panel"
                    className="bg-gray-900/95 text-white p-3 rounded-lg shadow-xl border border-gray-700 backdrop-blur-sm flex flex-col gap-2.5 text-xs"
                >
                    {/* Level switch / close row */}
                    <div className="w-full flex items-center justify-between pb-2 border-b border-gray-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Switch Floor:</span>
                            {floors.map((f, i) => (
                                <button
                                    key={f.floor_number ?? i}
                                    type="button"
                                    onClick={() => handleTabClick(i)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                        i === activeIdx
                                            ? 'bg-blue-600 text-white font-semibold'
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                                    }`}
                                    title={`Switch to ${f.name}`}
                                >
                                    {f.name || `Floor ${i}`} {i === activeIdx ? '✓' : ''}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setConfigOpen(false)}
                            className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-800 ml-auto"
                            title="Close settings drawer"
                        >
                            ✕ Close
                        </button>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400">Floor Name</label>
                        <input
                            type="text"
                            data-testid="floor-name-input"
                            value={activeFloor.name || ''}
                            onChange={(e) => updateFloorMeta(activeIdx, { name: e.target.value })}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-32"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400">Base Z (m)</label>
                        <input
                            type="number"
                            step="0.1"
                            data-testid="floor-z-input"
                            value={activeFloor.z_level ?? 0}
                            onChange={(e) => updateFloorMeta(activeIdx, { z_level: Number(e.target.value) })}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-20"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400">Height (m)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            data-testid="floor-height-input"
                            value={activeFloor.wall_height ?? 3}
                            onChange={(e) => updateFloorMeta(activeIdx, { wall_height: Number(e.target.value) })}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-20"
                        />
                    </div>

                    {/* Upload/Reuse PDF for this floor */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            data-testid="floor-pdf-input"
                            onChange={handlePdfInputChange}
                            className="hidden"
                        />
                        <button
                            type="button"
                            data-testid="floor-upload-pdf-button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-medium"
                            title="Upload or replace the PDF floor plan for this level"
                        >
                            📄 Upload Floor PDF
                        </button>
                        {activeIdx > 0 && onReuseGroundFloorPdf && (
                            <button
                                type="button"
                                data-testid="floor-reuse-pdf-button"
                                onClick={() => onReuseGroundFloorPdf(activeIdx)}
                                className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 font-medium transition-colors"
                                title="Reuse Ground Floor PDF background on this level"
                            >
                                📋 Use Ground Floor PDF
                            </button>
                        )}
                        <span
                            data-testid="floor-pdf-status"
                            className={`px-2 py-1 rounded text-[11px] font-medium border ${
                                activeIdx === 0 || activeFloor.pdfSource === 'custom'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : activeFloor.pdfSource === 'ground'
                                    ? 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                            }`}
                        >
                            {activeIdx === 0
                                ? '📄 Base PDF'
                                : activeFloor.pdfSource === 'ground'
                                ? '📋 Reusing Ground PDF'
                                : activeFloor.hasCustomPdf
                                ? '📄 Dedicated PDF'
                                : '📝 Blank Sheet + Ghost Floor'}
                        </span>
                    </div>

                    {/* Reference Origin (0,0) Tool */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            data-testid="floor-origin-tool-button"
                            onClick={() => {
                                if (isOriginTool) {
                                    setTool('selection')
                                } else {
                                    setTool('origin')
                                    setComment('')
                                }
                            }}
                            className={`px-2.5 py-1.5 rounded font-medium transition-colors ${
                                isOriginTool
                                    ? 'bg-amber-500 text-gray-950'
                                    : originPixels
                                    ? 'bg-amber-900/70 text-amber-200 border border-amber-600/60 hover:bg-amber-800'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600'
                            }`}
                            title="Click a common structural corner on each floor PDF to align levels in 2D and 3D"
                        >
                            {isOriginTool
                                ? '⊕ Click Plan to Set (0,0)…'
                                : originPixels
                                ? `⊕ Origin (${Math.round(originPixels.x)}, ${Math.round(originPixels.y)})`
                                : '⊕ Set (0,0) Origin'}
                        </button>
                        {originPixels && (
                            <button
                                type="button"
                                onClick={() => setOriginPixels(null)}
                                className="px-1.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                                title="Reset custom origin to bottom-left"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Floor Opening / Void Tool */}
                    <button
                        type="button"
                        data-testid="floor-opening-tool-button"
                        onClick={() => {
                            if (isFloorOpeningTool) {
                                setTool('selection')
                                setComment('')
                            } else {
                                setTool('rect')
                                setComment('floorOpening')
                            }
                        }}
                        className={`px-2.5 py-1.5 rounded font-medium transition-colors ${
                            isFloorOpeningTool
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 hover:bg-gray-700 text-purple-200 border border-purple-700/60'
                        }`}
                        title="Draw a rectangular opening/stair void through this floor's slab"
                    >
                        ⬜ Floor Opening / Void
                    </button>

                    {/* Re-calibrate scale on this floor */}
                    <button
                        type="button"
                        onClick={() => {
                            setTool('scale')
                            setComment('')
                        }}
                        className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
                        title="Re-calibrate scale for this floor's PDF"
                    >
                        📏 Scale
                    </button>

                    {floors.length > 1 && (
                        <button
                            type="button"
                            data-testid="delete-floor-button"
                            onClick={handleDeleteFloor}
                            className="px-2.5 py-1.5 rounded bg-red-900/70 hover:bg-red-800 text-red-200 border border-red-700/60 ml-auto"
                            title="Delete this floor level"
                        >
                            🗑 Delete Level
                        </button>
                    )}
                    </div>
                </div>
            )}
        </div>
    )
}
