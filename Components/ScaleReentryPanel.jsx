import { formatScale } from '../utils/scaleCalibration'

// Re-entry panel for the Scale tool (issue #19). When the user re-enters Set
// scale on an already-calibrated project, show the current scale (derived, in
// human terms) and the previous measurement instead of forcing a fresh
// measurement. The previously-measured calibration line is drawn on the canvas
// by Canvas.jsx; this panel offers the three actions.
//
// `canChangeLength` is false for legacy projects loaded from only the old
// pixels_per_mesh (no stored line to recompute from) — re-measure is the only
// way to recalibrate those.
function ScaleReentryPanel({ pixelsPerMesh, lengthMeters, canChangeLength, onRemeasure, onChangeLength, onCancel }) {
    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white text-black rounded-lg shadow-lg p-4 w-80">
        <h2 className="text-lg font-bold mb-1">Scale already set</h2>
        <p className="text-sm text-gray-700 mb-1">Current scale: <span className="font-mono">{formatScale(pixelsPerMesh)}</span></p>
        {lengthMeters != null && (
          <p className="text-xs text-gray-500 mb-3">Previously measured as {lengthMeters} m.</p>
        )}
        <div className="flex flex-col gap-2">
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={onRemeasure}>
            Re-measure
          </button>
          <button
            className="px-4 py-2 bg-blue-100 text-black rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onChangeLength}
            disabled={!canChangeLength}
            title={canChangeLength ? undefined : 'Re-measure first — this project has no stored calibration line.'}
          >
            Change length
          </button>
          <button className="px-4 py-2 bg-gray-200 text-black rounded-lg" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
}

export default ScaleReentryPanel
