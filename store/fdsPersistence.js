import { defaultDoorTimings } from './defaultDoorTimings'

// Per-mode persistence handlers for fdsGen — pure functions registered on the
// MODE_PERSISTENCE registry (see persistenceModes.js). Onboarding another mode
// onto the DB later means writing an equivalent pair and registering it; no
// changes to these or to the store dispatch are needed.

// Build the bulk-save payload for the projects API from store state.
export function buildFdsPayload(s) {
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
        floors: [
            {
                floor_number: 0,
                name: "Fire Floor",
                canvas_dimensions: s.canvasDimensions,
                pixels_per_mesh: s.pixelsPerMesh,
                origin_pixels: s.originPixels,
                settings: {
                    doorRoles: s.doorRoles,
                    doorLeakagesEnabled: s.doorLeakagesEnabled,
                    doorLeakageConfig: s.doorLeakageConfig,
                    landingRoles: s.landingRoles,
                    landingUpSide: s.landingUpSide,
                    stairStyle: s.stairStyle,
                    extractConfig: s.extractConfig,
                    inletConfig: s.inletConfig,
                    zoneConfig: s.zoneConfig,
                    sliceZHeight: s.sliceZHeight,
                },
                elements: s.elements.map((el, i) => ({
                    element_index: el.id ?? i,
                    type: el.type,
                    points: el.points,
                    comments: el.comments,
                    ...(el.zoneName ? { zoneName: el.zoneName } : {}),
                    ...(el.fsaDistance != null ? { fsaDistance: el.fsaDistance } : {}),
                })),
            },
        ],
    }
}

// Reconstruct the partial store state from a loaded project + floor detail.
// `state` is the current store state (for the per-mode geometry bucket spread).
export function hydrateFdsState(project, floorDetail, state) {
    const ps = project.settings || {}
    const fs = floorDetail.settings || {}
    const loadedElements = (floorDetail.elements || []).map(el => ({
        id: el.element_index,
        type: el.type,
        points: el.points,
        comments: el.comments,
        ...(el.zoneName ? { zoneName: el.zoneName } : {}),
        ...(el.fsaDistance != null ? { fsaDistance: el.fsaDistance } : {}),
    }))
    return {
        projectId: project.id,
        projectName: project.name,
        floorId: floorDetail.id,
        // Project-level settings
        scenarioType: ps.scenarioType ?? "MOE",
        simEndTime: ps.simEndTime ?? 300,
        totalFloors: ps.totalFloors ?? 8,
        wallHeight: ps.wallHeight ?? 3,
        stairRoofZ: ps.stairRoofZ ?? 25,
        topStoreyHeight: ps.topStoreyHeight ?? 20,
        fireFloorZ: ps.fireFloorZ ?? 0,
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
        canvasDimensions: floorDetail.canvas_dimensions || {},
        pixelsPerMesh: floorDetail.pixels_per_mesh || 1,
        originPixels: floorDetail.origin_pixels || null,
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
