import { useEffect, useState } from 'react'
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
    const [expanded, setExpanded] = useState(false)

    // The inputs stay mounted while geometry changes on the canvas.
    useEffect(() => { useStore.getState().setConvertedPoints() }, [elements, scale, canvasHeight])

    const choose = (nextTool, nextComment) => {
        const state = useStore.getState()
        state.setSelectedElement(null)
        state.setTool(nextTool)
        state.setComment(nextComment)
    }

    return <>
        <aside className="efs-drawing-panel" aria-label="Drawing tools">
            <div className="efs-panel-eyebrow">EXTERNAL FIRE SPREAD</div>
            <h2 className="text-lg font-semibold mt-1 mb-5">Drawing tools</h2>
            <div className="space-y-2">
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
                {tool === 'efsBay' ? 'Set column spacing on the right, then click a wall segment. Column distances update after each click.' : tool === 'polyline' ? 'Click to add points. Press Enter to finish the line.' : 'Select a drawing point to edit it. Use the middle mouse button to pan and Ctrl + wheel to zoom.'}
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
            <div className="flex gap-2 mt-5 border-t border-slate-200 pt-4">
                <button className="efs-secondary-button" disabled={!canUndo} onClick={() => useStore.getState().undo()} title="Ctrl+Z">↶ Undo</button>
                <button className="efs-secondary-button" disabled={!canRedo} onClick={() => useStore.getState().redo()} title="Ctrl+Shift+Z">↷ Redo</button>
            </div>
            <button className="efs-secondary-button mt-2 w-full" onClick={onChangeMode}>Change mode</button>
        </aside>
        <aside className={`efs-calculation-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Calculation parameters and results">
            <div className="efs-calculation-heading">
                <div><div className="efs-panel-eyebrow">ASSESSMENT</div><h2 className="text-lg font-semibold mt-1">Calculation</h2></div>
                <button className="efs-secondary-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Compact' : 'Expand'}</button>
            </div>
            <EfsPopup docked />
        </aside>
    </>
}
