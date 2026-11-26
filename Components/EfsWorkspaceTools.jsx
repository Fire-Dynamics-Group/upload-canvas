import { useEffect, useState, useTransition } from 'react'
import useStore from '../store/useStore'
import EfsPopup from './EfsPopup'

const drawingTools = [
    { tool: 'selection', comment: '', label: 'Select', hint: 'Select and edit drawing points', icon: 'M5 3l14 10-7 1-3 7z' },
    { tool: 'polyline', comment: 'efsWall', label: 'Build wall', hint: 'Draw the building outline', icon: 'M4 20V5h16v15M4 12h16M12 5v7M8 12v8M16 12v8' },
    { tool: 'polyline', comment: 'efsBoundary', label: 'Build boundary', hint: 'Draw the relevant boundary', icon: 'M3 5v14M21 5v14M3 12h3m3 0h3m3 0h3m2 0h1' },
    { tool: 'efsBay', comment: '', label: 'Set protection', hint: 'Click a segment to switch P / U', icon: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 3v18' },
]

export default function EfsWorkspaceTools({ onChangeMode }) {
    const tool = useStore(s => s.tool)
    const comment = useStore(s => s.comment)
    const elements = useStore(s => s.elements)
    const scale = useStore(s => s.pixelsPerMesh)
    const canvasHeight = useStore(s => s.canvasDimensions.height)
    const canUndo = useStore(s => s.elementsHistory.length > 0)
    const canRedo = useStore(s => s.elementsFuture.length > 0)
    const showScaleGrid = useStore(s => s.efsShowScaleGrid)
    const showDistanceArrows = useStore(s => s.efsShowDistanceArrows)
    const showDistances = useStore(s => s.efsShowDistances)
    const showGridSquares = useStore(s => s.efsShowGridSquares)
    const showGridNumbers = useStore(s => s.efsShowGridNumbers)
    const showBayLabels = useStore(s => s.efsShowBayLabels)
    const wallLineWidth = useStore(s => s.efsWallLineWidth)
    const boundaryLineWidth = useStore(s => s.efsBoundaryLineWidth)
    const neededBoundaryLineWidth = useStore(s => s.efsNeededBoundaryLineWidth)
    const arrowLineWidth = useStore(s => s.efsArrowLineWidth)
    const radiationFillOpacity = useStore(s => s.efsRadiationFillOpacity)
    const setShowScaleGrid = useStore(s => s.setEfsShowScaleGrid)
    const setShowDistanceArrows = useStore(s => s.setEfsShowDistanceArrows)
    const setShowDistances = useStore(s => s.setEfsShowDistances)
    const setShowGridSquares = useStore(s => s.setEfsShowGridSquares)
    const setShowGridNumbers = useStore(s => s.setEfsShowGridNumbers)
    const setShowBayLabels = useStore(s => s.setEfsShowBayLabels)
    const setWallLineWidth = useStore(s => s.setEfsWallLineWidth)
    const setBoundaryLineWidth = useStore(s => s.setEfsBoundaryLineWidth)
    const setNeededBoundaryLineWidth = useStore(s => s.setEfsNeededBoundaryLineWidth)
    const setArrowLineWidth = useStore(s => s.setEfsArrowLineWidth)
    const setRadiationFillOpacity = useStore(s => s.setEfsRadiationFillOpacity)
    // Keep the drawing tools collapsible while retaining Kevin's calculation
    // panel behavior: visible by default, with a compact/expanded width toggle.
    const [drawingOpen, setDrawingOpen] = useState(true)
    const [calcOpen, setCalcOpen] = useState(true)
    const [expanded, setExpanded] = useState(false)
    const [pendingAction, setPendingAction] = useState(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (!isPending) setPendingAction(null)
    }, [isPending])

    const handleOpenCalcs = () => {
        setPendingAction('opening')
        startTransition(() => setCalcOpen(true))
    }

    const handleMinimizeCalcs = () => {
        setPendingAction('closing')
        startTransition(() => setCalcOpen(false))
    }

    // The inputs stay mounted while geometry changes on the canvas.
    useEffect(() => { useStore.getState().setConvertedPoints() }, [elements, scale, canvasHeight])

    const choose = (nextTool, nextComment) => {
        const state = useStore.getState()
        state.setSelectedElement(null)
        state.setTool(nextTool)
        state.setComment(nextComment)
    }

    return <>
        <aside className={`efs-drawing-panel ${drawingOpen ? '' : 'is-collapsed'}`} aria-label="Drawing tools">
            <div className="efs-drawing-scroll">
                <div className="efs-panel-heading">
                    {drawingOpen && <div><div className="efs-panel-eyebrow">EXTERNAL FIRE SPREAD</div><h2 className="text-lg font-semibold mt-1">Drawing tools</h2></div>}
                    {!drawingOpen && <span className="efs-panel-eyebrow" title="Drawing tools">EFS</span>}
                    <button
                        type="button"
                        className="efs-secondary-button flex items-center justify-center"
                        aria-expanded={drawingOpen}
                        aria-label={drawingOpen ? 'Collapse drawing tools' : 'Expand drawing tools'}
                        title={drawingOpen ? 'Collapse drawing tools' : 'Open drawing tools'}
                        onClick={() => setDrawingOpen(!drawingOpen)}
                    >
                        {drawingOpen ? 'Collapse' : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M13 5l7 7-7 7M6 5l7 7-7 7" />
                            </svg>
                        )}
                    </button>
                </div>
                {drawingOpen ? <>
                <div className="space-y-2 mt-5">
                    {drawingTools.map(item => {
                        const active = tool === item.tool && (item.tool !== 'polyline' || comment === item.comment)
                        return <button key={item.label} type="button" aria-pressed={active}
                            className={`efs-tool-button ${active ? 'is-active' : ''}`}
                            onClick={() => choose(item.tool, item.comment)}>
                            <svg className="efs-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
                            <span><span className="block font-semibold">{item.label}</span><span className="block text-xs mt-1 opacity-75">{item.hint}</span></span>
                        </button>
                    })}
                </div>
                <div className="efs-protection-key">
                    <span><i style={{ background: '#2563eb' }} />Protected</span>
                    <span><i style={{ background: '#ef4444' }} />Unprotected</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {tool === 'efsBay' ? 'Set column spacing on the right, then click a wall segment. Column distances update after each click.' : tool === 'polyline' ? 'Click to add points. Press Enter to finish the line.' : 'Select a drawing point to edit it. Use the middle mouse button or two-finger scroll to pan and Ctrl + wheel to zoom.'}
                </p>
                <details className="text-xs border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer font-medium">Partial-height regions</summary>
                    <p className="text-slate-500 mt-2">Draw a region, then set its vertical band in the calculation panel.</p>
                    <div className="flex gap-2 mt-2">
                        {['efsProtected', 'efsUnprotected'].map(kind => <button key={kind} type="button"
                            aria-pressed={tool === 'polyline' && comment === kind}
                            className="rounded border border-slate-300 px-2 py-2 hover:bg-slate-100 aria-pressed:bg-blue-100"
                            onClick={() => choose('polyline', kind)}>{kind === 'efsProtected' ? 'Protected region' : 'Unprotected region'}</button>)}
                    </div>
                </details>
                <details className="text-xs border-t border-slate-200 pt-3 mt-3" open>
                    <summary className="cursor-pointer font-medium">Report display</summary>
                    <div className="space-y-2 mt-2 text-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showScaleGrid} onChange={(e) => setShowScaleGrid(e.target.checked)} />
                            <span>Scale grid</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showDistanceArrows} onChange={(e) => setShowDistanceArrows(e.target.checked)} />
                            <span>Distance arrows</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showDistances} onChange={(e) => setShowDistances(e.target.checked)} />
                            <span>Distances</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showGridSquares} onChange={(e) => setShowGridSquares(e.target.checked)} />
                            <span>Bay markers</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showGridNumbers} onChange={(e) => setShowGridNumbers(e.target.checked)} />
                            <span>Bay numbers</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showBayLabels} onChange={(e) => setShowBayLabels(e.target.checked)} />
                            <span>Bay labels (U/P)</span>
                        </label>
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                            <div className="font-medium text-slate-600">Line thickness</div>
                            {[
                                { label: 'Wall / bays', value: wallLineWidth, setter: setWallLineWidth, min: 1, max: 12 },
                                { label: 'Boundary', value: boundaryLineWidth, setter: setBoundaryLineWidth, min: 1, max: 12 },
                                { label: 'Needed boundary', value: neededBoundaryLineWidth, setter: setNeededBoundaryLineWidth, min: 1, max: 12 },
                                { label: 'Distance arrows', value: arrowLineWidth, setter: setArrowLineWidth, min: 0.5, max: 8 },
                            ].map((item) => (
                                <label key={item.label} className="block">
                                    <span className="flex items-center justify-between mb-0.5">
                                        <span>{item.label}</span>
                                        <span className="font-medium tabular-nums">{item.value} px</span>
                                    </span>
                                    <input
                                        type="range"
                                        min={item.min}
                                        max={item.max}
                                        step="0.5"
                                        value={item.value}
                                        onChange={(e) => item.setter(e.target.value)}
                                        className="w-full accent-blue-600 cursor-pointer"
                                        aria-label={`${item.label} line thickness`}
                                    />
                                </label>
                            ))}
                            <label className="block pt-1">
                                <span className="flex items-center justify-between mb-0.5">
                                    <span>Radiation area opacity</span>
                                    <span className="font-medium tabular-nums">{Math.round((radiationFillOpacity ?? 0.3) * 100)}%</span>
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step="0.01"
                                    value={radiationFillOpacity ?? 0.3}
                                    onChange={(e) => setRadiationFillOpacity(e.target.value)}
                                    className="w-full accent-orange-500 cursor-pointer"
                                    aria-label="Radiation area opacity"
                                />
                            </label>
                        </div>
                    </div>
                </details>
                <div className="flex gap-2 mt-5 border-t border-slate-200 pt-4">
                    <button className="efs-secondary-button" disabled={!canUndo} onClick={() => useStore.getState().undo()} title="Ctrl+Z">↶ Undo</button>
                    <button className="efs-secondary-button" disabled={!canRedo} onClick={() => useStore.getState().redo()} title="Ctrl+Shift+Z">↷ Redo</button>
                </div>
                <button className="efs-secondary-button mt-2 w-full" onClick={onChangeMode}>Change mode</button>
                </> : (
                    <div className="efs-tool-rail" aria-label="Drawing tool shortcuts">
                        {drawingTools.map(item => {
                            const active = tool === item.tool && (item.tool !== 'polyline' || comment === item.comment)
                            return <button
                                key={item.label}
                                type="button"
                                aria-pressed={active}
                                aria-label={item.label}
                                title={item.label}
                                className={`efs-tool-button efs-tool-rail-button ${active ? 'is-active' : ''}`}
                                onClick={() => choose(item.tool, item.comment)}
                            >
                                <svg className="efs-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
                            </button>
                        })}
                    </div>
                )}
            </div>
            {!calcOpen && (
                <div className="efs-drawing-footer">
                    <button
                        type="button"
                        className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-75"
                        onClick={handleOpenCalcs}
                        disabled={isPending}
                        aria-busy={isPending && pendingAction === 'opening'}
                        aria-label="Open calcs"
                        title="Open calculation panel"
                    >
                        {isPending && pendingAction === 'opening' && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                        )}
                        <span>
                            {isPending && pendingAction === 'opening'
                                ? (drawingOpen ? 'Opening calcs…' : '…')
                                : (drawingOpen ? 'Open calcs' : 'Calcs')}
                        </span>
                    </button>
                </div>
            )}
        </aside>
        {isPending && pendingAction && (
            <div
                role="status"
                aria-live="polite"
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg"
            >
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                <span>{pendingAction === 'opening' ? 'Opening calculations…' : 'Minimizing calculations…'}</span>
            </div>
        )}
        {calcOpen && (
            <aside className={`efs-calculation-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Calculation parameters and results">
                <div className="efs-calculation-heading">
                    <div><div className="efs-panel-eyebrow">ASSESSMENT</div><h2 className="text-lg font-semibold mt-1">Calculation</h2></div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="efs-secondary-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Compact' : 'Expand'}</button>
                        <button
                            type="button"
                            className="efs-secondary-button flex items-center gap-1.5"
                            aria-label="Minimize calculation panel"
                            title="Minimize calculation panel"
                            aria-busy={isPending && pendingAction === 'closing'}
                            disabled={isPending}
                            onClick={handleMinimizeCalcs}
                        >
                            {isPending && pendingAction === 'closing' && (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" aria-hidden="true" />
                            )}
                            <span>{isPending && pendingAction === 'closing' ? 'Closing…' : 'Minimize'}</span>
                        </button>
                    </div>
                </div>
                <EfsPopup docked />
            </aside>
        )}
    </>
}
