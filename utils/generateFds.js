import { saveAs } from 'file-saver'
import { sendFdsData } from '../Components/ApiCalls'
import { computeAutoSprinklerPositions } from './autoSprinklers'
import useStore from '../store/useStore'
import {
    getSyncedFloors,
    transformElementBetweenFloors,
    generateInterFloorSlabLines,
    combineMultiFloorFds,
} from './multiFloorFds'

const ensureNumber = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback)
const ensureInt = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback)
const ensureDict = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

/**
 * Sanitize an element into the exact schema expected by FastAPI /fds ElementsData:
 * { id: int, type: str, comments: str, points: [{ x: float, y: float }], zoneName?: str, fsaDistance?: float }
 */
function sanitizeBackendElement(el, fallbackId = 1) {
    if (!el) return null
    const id = Number.isInteger(Number(el.id)) ? Number(el.id) : fallbackId
    const type = typeof el.type === 'string' && el.type ? el.type : (el.points?.length === 1 ? 'point' : 'polyline')
    const comments = typeof el.comments === 'string' && el.comments
        ? el.comments
        : (typeof el.comment === 'string' && el.comment ? el.comment : 'obstruction')

    const rawPoints = Array.isArray(el.points) ? el.points : []
    const points = rawPoints
        .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }))

    if (points.length === 0) return null

    const out = { id, type, comments, points }
    if (el.zoneName) out.zoneName = String(el.zoneName)
    if (el.fsaDistance != null && Number.isFinite(Number(el.fsaDistance))) {
        out.fsaDistance = Number(el.fsaDistance)
    }
    return out
}

function prepareElementsForFloor(rawElements, pixelsPerMesh, isSprinklered) {
    // Filter out floorOpening elements before sending to backend (handled as slab HOLEs)
    const validRaw = (rawElements || [])
        .filter((el) => el && el.comments !== 'floorOpening')
        .map((el, i) => sanitizeBackendElement(el, i + 1))
        .filter(Boolean)

    let elementsToSend = validRaw
    const hasManualSprinklers = validRaw.some((el) => el.comments === 'sprinkler')
    if (isSprinklered && !hasManualSprinklers) {
        const autoPositions = computeAutoSprinklerPositions(validRaw, pixelsPerMesh)
        if (autoPositions.length > 0) {
            const maxId = Math.max(0, ...validRaw.map((el) => el.id || 0))
            const sprinklerEls = autoPositions.map((pos, i) => ({
                id: maxId + 1 + i,
                type: 'point',
                comments: 'sprinkler',
                points: [{ x: Number(pos.x), y: Number(pos.y) }],
            }))
            elementsToSend = [...validRaw, ...sprinklerEls]
        }
    }
    return elementsToSend
}

// Single source of truth for "generate the FDS file from the current drawing".
// Reads everything off the store (all FDS inputs live there), posts to the
// backend, and captures the returned text into the store so the 3D and
// FDS-code views can render it. Mirrors the argument assembly that used to live
// inline in Toolbar.handleFDSClick — both now call through here.
//
// When multiple floors have geometry, each floor is transformed into a shared
// world coordinate frame (via origin_pixels + pixels_per_mesh), generated at its
// respective z_level & wall_height, and combined with inter-floor slabs/openings.
export async function generateFdsCode({ download = true } = {}) {
    const s = useStore.getState()
    const syncedFloors = getSyncedFloors(s)

    const totalElementsCount = syncedFloors.reduce(
        (sum, f) => sum + (Array.isArray(f.elements) ? f.elements.length : 0),
        0
    )
    if (totalElementsCount === 0) {
        throw new Error('Please draw at least one Mesh on your floor plan before generating FDS.')
    }

    const hasMesh = syncedFloors.some((f) =>
        (f.elements || []).some((el) =>
            el && (el.comments === 'mesh' || el.comments === 'stairMesh' || el.comment === 'mesh' || el.comment === 'stairMesh')
        )
    )
    if (!hasMesh) {
        throw new Error('FDS requires at least one computational Mesh domain. Please draw a Mesh rectangle before generating FDS.')
    }

    const floorsWithGeometry = syncedFloors.filter(
        (f) => Array.isArray(f.elements) && f.elements.length > 0
    )
    const hasFloorOpenings = syncedFloors.some((f) =>
        (f.elements || []).some((el) => el && el.comments === 'floorOpening')
    )

    // Fast path: single-floor model with no inter-floor openings — preserve
    // exact existing single-call behaviour.
    if (floorsWithGeometry.length <= 1 && !hasFloorOpenings) {
        const activeFloor = floorsWithGeometry[0] || syncedFloors[s.activeFloorIndex ?? 0] || null
        const rawElements = activeFloor ? activeFloor.elements : s.elements
        const pxPerMesh = activeFloor?.pixels_per_mesh || s.pixelsPerMesh
        const zLevel = ensureNumber(activeFloor ? (activeFloor.z_level ?? s.fireFloorZ) : s.fireFloorZ, 0)
        const wallH = Math.max(0.1, ensureNumber(activeFloor ? (activeFloor.wall_height ?? s.wallHeight) : s.wallHeight, 3))
        const fs = activeFloor?.settings || {}

        const elementsToSend = prepareElementsForFloor(rawElements, pxPerMesh, s.isSprinklered)

        const topStoreyH = ensureNumber(s.topStoreyHeight, 20)
        const fireFloorNum = ensureInt(s.fireFloorNumber, 0)
        const totalFloorsNum = Math.max(1, ensureInt(s.totalFloors, 8))
        const stairRoofZNum = ensureNumber(s.stairRoofZ, 25)
        const pxPerM = Math.max(1, ensureNumber(pxPerMesh, 1)) * 10

        const text = await sendFdsData(
            elementsToSend,
            zLevel,
            wallH,
            topStoreyH,
            fireFloorNum,
            totalFloorsNum,
            stairRoofZNum,
            0.2, // wall_thickness
            pxPerM, // px_per_m — derived from scale calibration
            s.commonCorridorMode ? s.scenarioType : null,
            ensureInt(s.simEndTime, 300),
            Boolean(s.includeSensors),
            Array.isArray(s.corridorSensorHeights) ? s.corridorSensorHeights : [2.0],
            Array.isArray(s.stairSensorHeights) ? s.stairSensorHeights : [0.5, 1.0, 1.5, 2.0],
            Array.isArray(s.fsaSensorHeights) ? s.fsaSensorHeights : [1.5],
            Boolean(s.isSprinklered),
            Boolean(fs.doorLeakagesEnabled ?? s.doorLeakagesEnabled ?? true),
            ensureDict(fs.doorLeakageConfig ?? s.doorLeakageConfig),
            ensureDict(s.doorOpenings),
            ensureDict(fs.doorRoles ?? s.doorRoles),
            ensureDict(fs.landingRoles ?? s.landingRoles),
            fs.landingUpSide ?? s.landingUpSide ?? null,
            fs.stairStyle ?? s.stairStyle ?? 'individual',
            ensureDict(s.obstructionTransparency),
            s.aovMode ?? 'always_open',
            s.aovActivationTime != null ? Number(s.aovActivationTime) : null,
            s.aovType ?? 'hole',
            ensureDict(fs.extractConfig ?? s.extractConfig),
            ensureDict(fs.inletConfig ?? s.inletConfig),
            ensureDict(fs.zoneConfig ?? s.zoneConfig),
            ensureNumber(s.fireHRR, 1000),
            ensureNumber(s.fireDimension, 1.4),
            ensureNumber(s.fireHeightAboveFloor, 0.5),
            ensureNumber(s.fireBase, 0.0),
            s.fireType ?? 'growing',
            s.fireGrowthRate ?? 'medium',
            s.fireCustomAlpha != null ? Number(s.fireCustomAlpha) : null,
            ensureNumber(fs.sliceZHeight ?? s.sliceZHeight, 2.0),
            { download },
        )

        if (typeof text === 'string') s.captureFds(text)
        return text
    }

    // Multi-floor path: align all floors to baseFloor's coordinate frame
    const sortedFloors = [...floorsWithGeometry].sort(
        (a, b) => (Number(a.z_level) || 0) - (Number(b.z_level) || 0)
    )
    const baseFloor = sortedFloors[0]
    const basePxPerMesh = Number(baseFloor.pixels_per_mesh) || Number(s.pixelsPerMesh) || 1
    const basePxPerM = Math.max(1, basePxPerMesh * 10)
    const minZ = Math.min(...sortedFloors.map((f) => Number(f.z_level) || 0))

    // Transform all floors' elements into baseFloor's pixel space
    const transformedByFloor = sortedFloors.map((floor) => {
        const mappedElements = (floor.elements || []).map((el) =>
            transformElementBetweenFloors(el, floor, baseFloor)
        )
        return { floor, mappedElements }
    })

    // Compute global bounding box across all floors (in baseFloor pixel space)
    let globalMinX = Infinity
    let globalMaxY = -Infinity
    for (const { mappedElements } of transformedByFloor) {
        for (const el of mappedElements) {
            if (!el || el.comments === 'floorOpening') continue
            for (const p of el.points || []) {
                if (p && Number.isFinite(p.x) && p.x < globalMinX) globalMinX = p.x
                if (p && Number.isFinite(p.y) && p.y > globalMaxY) globalMaxY = p.y
            }
        }
    }
    if (!Number.isFinite(globalMinX)) globalMinX = 0
    if (!Number.isFinite(globalMaxY)) globalMaxY = 0

    const floorRuns = []
    for (const { floor, mappedElements } of transformedByFloor) {
        const backendEls = prepareElementsForFloor(mappedElements, basePxPerMesh, s.isSprinklered)
        if (backendEls.length === 0) continue

        let floorMinX = Infinity
        let floorMaxY = -Infinity
        for (const el of backendEls) {
            for (const p of el.points || []) {
                if (p.x < floorMinX) floorMinX = p.x
                if (p.y > floorMaxY) floorMaxY = p.y
            }
        }

        const dx = Number.isFinite(floorMinX)
            ? Math.round(((floorMinX - globalMinX) / basePxPerM) * 10) / 10
            : 0
        const dy = Number.isFinite(floorMaxY)
            ? Math.round(((globalMaxY - floorMaxY) / basePxPerM) * 10) / 10
            : 0

        const fs = floor.settings || {}
        const zLevel = ensureNumber(floor.z_level, 0)
        const wallH = Math.max(0.1, ensureNumber(floor.wall_height ?? s.wallHeight, 3))
        const topStoreyH = ensureNumber(s.topStoreyHeight, 20)
        const floorNum = ensureInt(floor.floor_number ?? s.fireFloorNumber, 0)
        const totalFloorsNum = Math.max(1, ensureInt(s.totalFloors, 8))
        const stairRoofZNum = ensureNumber(s.stairRoofZ, 25)

        const fdsText = await sendFdsData(
            backendEls,
            zLevel,
            wallH,
            topStoreyH,
            floorNum,
            totalFloorsNum,
            stairRoofZNum,
            0.2,
            basePxPerM,
            s.commonCorridorMode ? s.scenarioType : null,
            ensureInt(s.simEndTime, 300),
            Boolean(s.includeSensors),
            Array.isArray(s.corridorSensorHeights) ? s.corridorSensorHeights : [2.0],
            Array.isArray(s.stairSensorHeights) ? s.stairSensorHeights : [0.5, 1.0, 1.5, 2.0],
            Array.isArray(s.fsaSensorHeights) ? s.fsaSensorHeights : [1.5],
            Boolean(s.isSprinklered),
            Boolean(fs.doorLeakagesEnabled ?? s.doorLeakagesEnabled ?? true),
            ensureDict(fs.doorLeakageConfig ?? s.doorLeakageConfig),
            ensureDict(s.doorOpenings),
            ensureDict(fs.doorRoles ?? {}),
            ensureDict(fs.landingRoles ?? {}),
            fs.landingUpSide ?? null,
            fs.stairStyle ?? 'individual',
            ensureDict(s.obstructionTransparency),
            s.aovMode ?? 'always_open',
            s.aovActivationTime != null ? Number(s.aovActivationTime) : null,
            s.aovType ?? 'hole',
            ensureDict(fs.extractConfig ?? {}),
            ensureDict(fs.inletConfig ?? {}),
            ensureDict(fs.zoneConfig ?? {}),
            ensureNumber(s.fireHRR, 1000),
            ensureNumber(s.fireDimension, 1.4),
            ensureNumber(s.fireHeightAboveFloor, 0.5),
            ensureNumber(s.fireBase, 0.0),
            s.fireType ?? 'growing',
            s.fireGrowthRate ?? 'medium',
            s.fireCustomAlpha != null ? Number(s.fireCustomAlpha) : null,
            ensureNumber(fs.sliceZHeight, 2.0),
            { download: false },
        )

        const isUpperFloor = zLevel > minZ || hasFloorOpenings
        const slabLines = isUpperFloor
            ? generateInterFloorSlabLines(mappedElements, floor, globalMinX, globalMaxY, basePxPerM)
            : []

        floorRuns.push({ floor, fdsText, dx, dy, slabLines })
    }

    if (floorRuns.length === 0) {
        throw new Error('No valid floor geometry found to generate FDS.')
    }

    const combinedText = combineMultiFloorFds(floorRuns)
    if (download && combinedText && typeof window !== 'undefined') {
        const blob = new Blob([combinedText], { type: 'text/plain;charset=utf-8' })
        saveAs(blob, 'test.fds')
    }
    if (typeof combinedText === 'string') s.captureFds(combinedText)
    return combinedText
}
