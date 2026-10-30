import { sendFdsData } from '../Components/ApiCalls'
import { computeAutoSprinklerPositions } from './autoSprinklers'
import useStore from '../store/useStore'

export function quantizePointToGrid(point, pixelsPerMesh) {
    const step = Number(pixelsPerMesh)
    const g = Number.isFinite(step) && step > 0 ? step : 1
    return {
        x: Math.round(Number(point.x) / g) * g,
        y: Math.round(Number(point.y) / g) * g,
    }
}

function collapseDuplicatePoints(points) {
    if (!Array.isArray(points) || points.length === 0) return []
    const out = [points[0]]
    for (let i = 1; i < points.length; i++) {
        const prev = out[out.length - 1]
        const p = points[i]
        if (p.x !== prev.x || p.y !== prev.y) out.push(p)
    }
    return out
}

/** Snap drawing vertices onto the mesh grid before POST /fds so a 0.086 px
 * off-vertical wall does not become a zero-thickness OBST (Railway 500). */
export function prepareElementsForFloor(rawElements, pixelsPerMesh, _isSprinklered) {
    return (rawElements || [])
        .filter((el) => el && Array.isArray(el.points))
        .map((el) => {
            const quantized = el.points.map((p) => quantizePointToGrid(p, pixelsPerMesh))
            const points = el.type === 'point' ? quantized : collapseDuplicatePoints(quantized)
            if (el.type !== 'point' && points.length < 2) return null
            if (el.type === 'point' && points.length === 0) return null
            return { ...el, points }
        })
        .filter(Boolean)
}

// Single source of truth for "generate the FDS file from the current drawing".
// Reads everything off the store (all FDS inputs live there), posts to the
// backend, and captures the returned text into the store so the 3D and
// FDS-code views can render it. Mirrors the argument assembly that used to live
// inline in Toolbar.handleFDSClick — both now call through here.
//
// opts.download (default true) keeps the existing "save test.fds" behaviour for
// the toolbar button; the in-app views pass false to refresh silently.
export async function generateFdsCode({ download = true } = {}) {
    const s = useStore.getState()
    const freshElements = s.elements

    // Inject auto-placed sprinklers so the backend uses the frontend-computed
    // positions (only when sprinklered and none were placed by hand).
    let elementsToSend = freshElements
    const hasManualSprinklers = freshElements.some((el) => el.comments === 'sprinkler')
    if (s.isSprinklered && !hasManualSprinklers) {
        const autoPositions = computeAutoSprinklerPositions(freshElements, s.pixelsPerMesh)
        if (autoPositions.length > 0) {
            const maxId = Math.max(0, ...freshElements.map((el) => el.id || 0))
            const sprinklerEls = autoPositions.map((pos, i) => ({
                id: maxId + 1 + i,
                type: 'point',
                comments: 'sprinkler',
                points: [{ x: pos.x, y: pos.y }],
            }))
            elementsToSend = [...freshElements, ...sprinklerEls]
        }
    }

    elementsToSend = prepareElementsForFloor(elementsToSend, s.pixelsPerMesh, s.isSprinklered)

    const text = await sendFdsData(
        elementsToSend,
        Number(s.fireFloorZ),
        Number(s.wallHeight),
        Number(s.topStoreyHeight),
        Number(s.fireFloorNumber),
        Number(s.totalFloors),
        Number(s.stairRoofZ),
        0.2, // wall_thickness
        s.pixelsPerMesh * 10, // px_per_m — derived from scale calibration
        s.commonCorridorMode ? s.scenarioType : null,
        s.simEndTime,
        s.includeSensors,
        s.corridorSensorHeights,
        s.stairSensorHeights,
        s.fsaSensorHeights,
        s.isSprinklered,
        s.doorLeakagesEnabled,
        s.doorLeakageConfig,
        s.doorOpenings,
        s.doorRoles,
        s.landingRoles,
        s.landingUpSide,
        s.stairStyle,
        s.obstructionTransparency,
        s.aovMode,
        s.aovActivationTime,
        s.aovType,
        s.extractConfig,
        s.inletConfig,
        s.zoneConfig,
        s.fireHRR,
        s.fireDimension,
        s.fireHeightAboveFloor,
        s.fireBase,
        s.fireType,
        s.fireGrowthRate,
        s.fireCustomAlpha,
        s.sliceZHeight,
        { download },
    )

    if (typeof text === 'string') s.captureFds(text)
    return text
}
