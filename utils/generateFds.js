import { sendFdsData } from '../Components/ApiCalls'
import { computeAutoSprinklerPositions } from './autoSprinklers'
import useStore from '../store/useStore'

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
