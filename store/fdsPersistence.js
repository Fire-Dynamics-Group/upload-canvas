import { defaultDoorTimings } from './defaultDoorTimings'
import { getSyncedFloors, normalizeFloor, toElementIndex } from '../utils/multiFloorFds'

// Per-mode persistence handlers for fdsGen — pure functions registered on the
// MODE_PERSISTENCE registry (see persistenceModes.js). Onboarding another mode
// onto the DB later means writing an equivalent pair and registering it; no
// changes to these or to the store dispatch are needed.

// Build the bulk-save payload for the projects API from store state.
export function buildFdsPayload(s) {
    const syncedFloors = getSyncedFloors(s)
    const floorsPayload = syncedFloors.map((f, idx) => {
        const floorNumber = f.floor_number ?? idx
        const fs = f.settings || {}
        return {
            floor_number: floorNumber,
            name: f.name || (floorNumber === 0 ? "Fire Floor" : `Floor ${floorNumber}`),
            canvas_dimensions: f.canvas_dimensions || {},
            pixels_per_mesh: f.pixels_per_mesh || 1,
            origin_pixels: f.origin_pixels ?? null,
            settings: {
                z_level: f.z_level ?? fs.z_level ?? 0,
                wall_height: f.wall_height ?? fs.wall_height ?? Number(s.wallHeight) ?? 3,
                doorRoles: fs.doorRoles ?? {},
                doorLeakagesEnabled: fs.doorLeakagesEnabled ?? true,
                doorLeakageConfig: fs.doorLeakageConfig ?? {},
                landingRoles: fs.landingRoles ?? {},
                landingUpSide: fs.landingUpSide ?? null,
                stairStyle: fs.stairStyle ?? "individual",
                extractConfig: fs.extractConfig ?? {},
                inletConfig: fs.inletConfig ?? {},
                zoneConfig: fs.zoneConfig ?? {},
                sliceZHeight: fs.sliceZHeight ?? 2.0,
            },
            elements: (f.elements || []).map((el, i) => ({
                element_index: toElementIndex(el, i),
                type: el.type,
                points: el.points,
                comments: el.comments,
                ...(el.zoneName ? { zoneName: el.zoneName } : {}),
                ...(el.fsaDistance != null ? { fsaDistance: el.fsaDistance } : {}),
            })),
        }
    })

    return {
        name: s.projectName || "Untitled Project",
        settings: {
            scenarioType: s.scenarioType,
            simEndTime: s.simEndTime,
            totalFloors: s.totalFloors,
            wallHeight: s.wallHeight,
            stairRoofZ: s.stairRoofZ,
            topStoreyHeight: s.topStoreyHeight,
            fireFloorZ: s.fireFloorZ,
            fireFloorNumber: s.fireFloorNumber,
            commonCorridorMode: s.commonCorridorMode,
            includeSensors: s.includeSensors,
            corridorSensorHeights: s.corridorSensorHeights,
            stairSensorHeights: s.stairSensorHeights,
            fsaSensorHeights: s.fsaSensorHeights,
            isSprinklered: s.isSprinklered,
            doorOpenings: s.doorOpenings,
            aovMode: s.aovMode,
            aovActivationTime: s.aovActivationTime,
            aovType: s.aovType,
            obstructionTransparency: s.obstructionTransparency,
            totalHeatFlux: s.totalHeatFlux,
            heatEndpoint: s.heatEndpoint,
            fireHRR: s.fireHRR,
            fireDimension: s.fireDimension,
            fireHeightAboveFloor: s.fireHeightAboveFloor,
            fireBase: s.fireBase,
            fireType: s.fireType,
            fireGrowthRate: s.fireGrowthRate,
            fireCustomAlpha: s.fireCustomAlpha,
            numberOfStairs: s.numberOfStairs,
            stairObject: s.stairObject,
            thumbnail: s.thumbnail,
        },
        floors: floorsPayload,
    }
}

// Reconstruct the partial store state from a loaded project + floor detail (or array of floor details).
// `state` is the current store state (for the per-mode geometry bucket spread).
export function hydrateFdsState(project, floorDetailOrList, state = {}) {
    const ps = project.settings || {}
    const rawFloorList = Array.isArray(floorDetailOrList)
        ? floorDetailOrList
        : floorDetailOrList
        ? [floorDetailOrList]
        : []

    const sortedFloors = [...rawFloorList]
        .sort((a, b) => (a.floor_number ?? 0) - (b.floor_number ?? 0))
        .map((fd, idx) =>
            normalizeFloor(fd, idx, {
                fireFloorZ: ps.fireFloorZ ?? 0,
                wallHeight: ps.wallHeight ?? 3,
                pixelsPerMesh: fd.pixels_per_mesh || 1,
            })
        )

    const primaryFloor = sortedFloors[0] || normalizeFloor(floorDetailOrList || {}, 0, ps)
    const fs = primaryFloor.settings || {}
    const loadedElements = primaryFloor.elements || []

    return {
        projectId: project.id,
        projectName: project.name,
        floorId: primaryFloor.id,
        floors: sortedFloors,
        activeFloorIndex: 0,
        // Project-level settings
        scenarioType: ps.scenarioType ?? "MOE",
        simEndTime: ps.simEndTime ?? 300,
        totalFloors: ps.totalFloors ?? 8,
        wallHeight: primaryFloor.wall_height ?? ps.wallHeight ?? 3,
        stairRoofZ: ps.stairRoofZ ?? 25,
        topStoreyHeight: ps.topStoreyHeight ?? 20,
        fireFloorZ: primaryFloor.z_level ?? ps.fireFloorZ ?? 0,
        fireFloorNumber: ps.fireFloorNumber ?? 0,
        commonCorridorMode: ps.commonCorridorMode ?? false,
        includeSensors: ps.includeSensors ?? true,
        corridorSensorHeights: ps.corridorSensorHeights ?? [2.0],
        stairSensorHeights: ps.stairSensorHeights ?? [0.5, 1.0, 1.5, 2.0],
        fsaSensorHeights: ps.fsaSensorHeights ?? [1.5],
        isSprinklered: ps.isSprinklered ?? true,
        doorOpenings: ps.doorOpenings ?? { ...defaultDoorTimings.MOE },
        aovMode: ps.aovMode ?? "always_open",
        aovActivationTime: ps.aovActivationTime ?? null,
        aovType: ps.aovType ?? "hole",
        obstructionTransparency: ps.obstructionTransparency ?? { stairWalls: 0.25, stairRoof: 0.25, fireFloorWalls: 0.0 },
        totalHeatFlux: ps.totalHeatFlux ?? 476,
        heatEndpoint: ps.heatEndpoint ?? 1.3333,
        fireHRR: ps.fireHRR ?? 1000,
        fireDimension: ps.fireDimension ?? 1.4,
        fireHeightAboveFloor: ps.fireHeightAboveFloor ?? 0.5,
        fireBase: ps.fireBase ?? 0.0,
        fireType: ps.fireType ?? "growing",
        fireGrowthRate: ps.fireGrowthRate ?? "medium",
        fireCustomAlpha: ps.fireCustomAlpha ?? null,
        numberOfStairs: ps.numberOfStairs ?? 0,
        stairObject: ps.stairObject ?? [],
        // Floor-level settings
        canvasDimensions: primaryFloor.canvas_dimensions || {},
        pixelsPerMesh: primaryFloor.pixels_per_mesh || 1,
        originPixels: primaryFloor.origin_pixels || null,
        doorRoles: fs.doorRoles ?? {},
        doorLeakagesEnabled: fs.doorLeakagesEnabled ?? true,
        doorLeakageConfig: fs.doorLeakageConfig ?? {},
        landingRoles: fs.landingRoles ?? {},
        landingUpSide: fs.landingUpSide ?? null,
        stairStyle: fs.stairStyle ?? "individual",
        extractConfig: fs.extractConfig ?? {},
        inletConfig: fs.inletConfig ?? {},
        zoneConfig: fs.zoneConfig ?? {},
        sliceZHeight: fs.sliceZHeight ?? 2.0,
        // Elements — load into both the live array and the active bucket
        elements: loadedElements,
        elementsByMode: { ...state.elementsByMode, [state.currentMode]: loadedElements },
    }
}

// The subset of state whose change should arm the debounced autosave.
export function fdsAutosaveSnapshot(s) {
    const syncedFloors = getSyncedFloors(s)
    return {
        elements: s.elements,
        floors: syncedFloors.map((f) => ({
            floor_number: f.floor_number,
            name: f.name,
            z_level: f.z_level,
            wall_height: f.wall_height,
            pixels_per_mesh: f.pixels_per_mesh,
            origin_pixels: f.origin_pixels,
            elements: f.elements,
            settings: f.settings,
        })),
        pixelsPerMesh: s.pixelsPerMesh,
        canvasDimensions: s.canvasDimensions,
        originPixels: s.originPixels,
        scenarioType: s.scenarioType,
        simEndTime: s.simEndTime,
        totalFloors: s.totalFloors,
        wallHeight: s.wallHeight,
        fireFloorZ: s.fireFloorZ,
        doorRoles: s.doorRoles,
        doorOpenings: s.doorOpenings,
        doorLeakagesEnabled: s.doorLeakagesEnabled,
        doorLeakageConfig: s.doorLeakageConfig,
        landingRoles: s.landingRoles,
        landingUpSide: s.landingUpSide,
        stairStyle: s.stairStyle,
        aovMode: s.aovMode,
        aovActivationTime: s.aovActivationTime,
        extractConfig: s.extractConfig,
        inletConfig: s.inletConfig,
        zoneConfig: s.zoneConfig,
        obstructionTransparency: s.obstructionTransparency,
        sliceZHeight: s.sliceZHeight,
    }
}
