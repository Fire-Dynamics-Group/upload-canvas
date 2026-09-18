import { useState } from 'react'
import useStore from '../store/useStore'
import { findMisclassifiedObstructions } from '../utils/stairMeshValidation'

/**
 * Advisory banner: warns when normal obstructions have been drawn inside a
 * stair mesh (they export as solid OBSTs instead of becoming steps) and offers
 * a one-click reclassification to stair obstructions. Never blocks anything.
 */
export default function StairMeshWarning() {
    const elements = useStore((state) => state.elements)
    const viewMode = useStore((state) => state.viewMode)
    const convertObstructionsToStair = useStore((state) => state.convertObstructionsToStair)
    const [dismissedKey, setDismissedKey] = useState(null)

    const flagged = findMisclassifiedObstructions(elements)
    // Re-show the banner whenever the set of offending elements changes, even
    // after a dismiss — a newly drawn stray obstruction should warn again.
    const flaggedKey = flagged.map((el) => el.id).join(',')

    if (viewMode !== '2d' || flagged.length === 0 || dismissedKey === flaggedKey) {
        return null
    }

    const count = flagged.length
    const noun = count === 1 ? 'obstruction is' : 'obstructions are'

    return (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-500 text-black text-sm px-4 py-2 rounded-lg shadow-lg max-w-xl">
            <span>
                {count} normal {noun} inside a stair mesh — did you mean stair obstructions?
            </span>
            <button
                type="button"
                onClick={() => convertObstructionsToStair()}
                className="bg-black text-white rounded px-3 py-1 hover:bg-gray-800 whitespace-nowrap"
            >
                Convert {count === 1 ? 'it' : `all ${count}`}
            </button>
            <button
                type="button"
                onClick={() => setDismissedKey(flaggedKey)}
                aria-label="Dismiss"
                className="text-black/70 hover:text-black px-1"
            >
                ✕
            </button>
        </div>
    )
}
