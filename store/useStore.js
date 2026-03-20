import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {findOriginPixels, returnFinalCoordinates} from '../utils/pointManipulation'
import { clearPdfFromIndexedDB } from '../utils/pdfStorage'

const defaultDoorTimings = {
    MOE: {
        apartment_open: 60,
        apartment_close: 80,
        stair_open: 70,
        stair_close: 90,
    },
    FSA: {
        stair_open: 0,
        apartment_open: 60,
    },
    Both: {
        apartment_open: 60,
        apartment_close: 80,
        stair_open: 70,
        stair_close: 90,
        fsa_apartment_open: 400,
        fsa_stair_open: 400,
    },
}

const useStore = create(persist((set, get) => {
    const defaultStairObject = {"fire_floor": 0, "total_floors": 5, "stair_roof_z": 25, "top_storey_height": 21}
    return {

        // Project persistence
        projectId: null,
        floorId: null,
        projectName: null,
        saveStatus: null, // null | "saving" | "saved" | "error"

        elements: [],
        tool: "scale",
        selectedElement: null,
        currentMode: "fdsGen",
        comment: "",
        canvasDimensions: {},
        pixelsPerMesh: 1,
        originPixels: null,
        convertedPoints: [],
        hasDoor: false,
        pdfData: null,
        pdfIsGreyscale: false,
        pdfCanvasRef: null,
        totalHeatFlux: 476,
        heatEndpoint: 1.3333,
        fireFloorZ: 0,
        fireFloorNumber: 0,
        showTimeEqPopup: false,
        numberOfStairs: 0,
        totalFloors: 8,
        stairRoofZ: 25,
        wallHeight: 3,
        topStoreyHeight: 20,

        // Common corridor mode
        commonCorridorMode: false,

        // Scenario settings (common corridor only)
        scenarioType: "MOE", // "MOE", "FSA", or "Both"
        simEndTime: 300,

        // Device settings
        includeSensors: true,
        corridorSensorHeights: [2.0], // above fire floor, all types (temp, pressure, vis, velocity)
        stairSensorHeights: [0.5, 1.0, 1.5, 2.0], // above fire floor, tree of sensors at each stair position
        isSprinklered: true,

        // Door role assignment: { [doorId]: "apartment" | "stair" | "lobby" | "other" }
        doorRoles: {},
        highlightedDoorId: null,

        // Door leakage settings
        doorLeakagesEnabled: true,
        doorLeakageConfig: {}, // per-door: { [doorId]: { enabled: true, sealType: "non-smoke-sealed" } }

        // Door openings - defaults per scenario type
        doorOpenings: { ...defaultDoorTimings.MOE },

        // Landing role assignment: { [landingId]: "floor" | "half" }
        landingRoles: {},
        highlightedLandingId: null,
        // Which half of the floor landing goes up: "left"|"right"|"top"|"bottom"
        landingUpSide: null,

        // AOV settings
        aovMode: "always_open", // "always_open" | "timed" | "sprinkler"
        aovActivationTime: null, // seconds, used when aovMode is "timed"

        // Obstruction transparency settings (0 = opaque, 1 = fully transparent)
        obstructionTransparency: {
            stairWalls: 0.25,
            stairRoof: 0.25,
            fireFloorWalls: 0.0,
        },

        stairObject: [],
        mapStairObject: () => set((state) => ({
            stairObject: state.stairObject.map((stair, index) => {
                return {
                    ...defaultStairObject,
                    index: index
                }
            })
        })),
        // have local state and update object only when user clicks okay
        changeStairObject: (newStairObject) => set(() => ({
            stairObject: newStairObject
        })),
        
        addElement: (newEl) => set((state) => ({
            elements: [...state.elements, newEl]
        })),
        changeElement: (changedEl) =>  set((state) => ({
            elements: 
                state.elements.map(element => {
                    if (element.id === changedEl.id) {
                        return changedEl
                    } else {
                        return element
                    }
                })         
        })),
        removeElement: (selectedID) => set((state) => ({
            elements: state.elements.filter(element => element.id !== selectedID)
        })),
        // change tool to incoming
        // if tool not selection; set selection to null
        setTool: (newTool) => {
            set(() => {
                if (newTool != 'selection') 
                return {
                    tool: newTool,
                    selectedElement: null,
                }
                return {
                    tool: newTool
                }
            }
            )
        },

        setSelectedElement: (newEl) => set(() => ({
            selectedElement: newEl
        })),
        setCurrentMode: (newMode) => set(() => ({
            currentMode: newMode
        })),
        setComment: (newComment) => set(() => ({
            comment: newComment
        })),
        setCanvasDimensions: (dimensions) => set(() => ({
            canvasDimensions: dimensions
        })),
        setPixelsPerMesh: (pxPerMesh) => set(() => ({
            pixelsPerMesh: pxPerMesh
        })),

        setConvertedPoints: () => set((state) => {
            let tempOrigin = findOriginPixels(state.elements, state.canvasDimensions.height)
            console.log("tempOrigin: ", tempOrigin)
            return{
                originPixels: tempOrigin,
                convertedPoints: returnFinalCoordinates(state.pixelsPerMesh * 10 , state.elements, tempOrigin, state.canvasDimensions.height)
            }
        }),
        mockConvertedPoints: (mockedConvertedPoints) => set(() => ({
                convertedPoints: mockedConvertedPoints
        })),

        setHasDoor: (newBool) => set(() => ({
            hasDoor: newBool
        })),

        setPdfData: (newPdfData) => set(() => ({
            pdfData: newPdfData
        })),
        toggleIsPdfGreyscale: (newBool) => set(() => ({
            pdfIsGreyscale: newBool
        })),
        setPdfCanvasRef: (newRef) => set(() => ({
            pdfCanvasRef: newRef
        })),
        setTotalHeatFlux: (newVal) => set(() => ({
            totalHeatFlux: newVal
        })),
        setHeatEndpoint: (newVal) => set(() => ({
            heatEndpoint: newVal
        })),
        setShowTimeEqPopup: (newBool) => set(() => ({
            showTimeEqPopup: newBool
        })),
        setFireFloorZ: (newVal) => set(() => ({
            fireFloorZ: newVal
        })),
        // setFireFloorZ: (newVal) => set(() => ({
        //     fireFloorZ: newVal
        // })),
        setFireFloorNumber: (newVal) => set(() => ({
            fireFloorNumber: newVal
        })),
        setTotalFloors: (newVal) => set(() => ({
            totalFloors: newVal
        })),
        setWallHeight: (newVal) => set(() => ({
            wallHeight: newVal
        })),
        setStairRoofZ: (newVal) => set(() => ({
            stairRoofZ: newVal
        })),
        setTopStoreyHeight: (newVal) => set(() => ({
            topStoreyHeight: newVal
        })),

        setAovMode: (newVal) => set(() => ({
            aovMode: newVal,
            // Clear activation time when switching away from timed
            ...(newVal !== "timed" ? { aovActivationTime: null } : {}),
        })),
        setAovActivationTime: (newVal) => set(() => ({
            aovActivationTime: newVal
        })),

        setCommonCorridorMode: (newVal) => set(() => ({
            commonCorridorMode: newVal,
            // Reset scenario defaults when toggling on
            ...(newVal ? {
                scenarioType: "MOE",
                doorOpenings: { ...defaultDoorTimings.MOE },
                simEndTime: 300,
            } : {
                scenarioType: null,
                doorOpenings: {},
            }),
        })),

        // Scenario setters (common corridor only)
        setScenarioType: (newVal) => set(() => ({
            scenarioType: newVal,
            doorOpenings: { ...defaultDoorTimings[newVal] },
            simEndTime: newVal === "Both" ? 1800 : 300,
        })),
        setSimEndTime: (newVal) => set(() => ({
            simEndTime: newVal
        })),

        // Device setters
        setIncludeSensors: (newVal) => set(() => ({
            includeSensors: newVal
        })),
        setCorridorSensorHeights: (newVal) => set(() => ({
            corridorSensorHeights: newVal
        })),
        setStairSensorHeights: (newVal) => set(() => ({
            stairSensorHeights: newVal
        })),
        setIsSprinklered: (newVal) => set(() => ({
            isSprinklered: newVal
        })),

        // Door role setters
        setDoorRoles: (newVal) => set(() => ({
            doorRoles: newVal
        })),
        setHighlightedDoorId: (newVal) => set(() => ({
            highlightedDoorId: newVal
        })),

        // Door leakage setters
        setDoorLeakagesEnabled: (newVal) => set(() => ({
            doorLeakagesEnabled: newVal
        })),
        setDoorLeakageConfig: (newVal) => set(() => ({
            doorLeakageConfig: newVal
        })),

        // Door openings setter
        setDoorOpenings: (newVal) => set(() => ({
            doorOpenings: newVal
        })),

        // Landing role setters
        setLandingRoles: (newVal) => set(() => ({ landingRoles: newVal })),
        setHighlightedLandingId: (newVal) => set(() => ({ highlightedLandingId: newVal })),
        setLandingUpSide: (newVal) => set(() => ({ landingUpSide: newVal })),

        // Obstruction transparency setter
        setObstructionTransparency: (newVal) => set(() => ({ obstructionTransparency: newVal })),

        // Project persistence setters
        setProjectId: (newVal) => set(() => ({ projectId: newVal })),
        setFloorId: (newVal) => set(() => ({ floorId: newVal })),
        setProjectName: (newVal) => set(() => ({ projectName: newVal })),
        setSaveStatus: (newVal) => set(() => ({ saveStatus: newVal })),

        // Build the bulk-save payload from current state
        buildSavePayload: () => {
            const s = get()
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
                    isSprinklered: s.isSprinklered,
                    doorOpenings: s.doorOpenings,
                    aovMode: s.aovMode,
                    aovActivationTime: s.aovActivationTime,
                    obstructionTransparency: s.obstructionTransparency,
                    totalHeatFlux: s.totalHeatFlux,
                    heatEndpoint: s.heatEndpoint,
                    numberOfStairs: s.numberOfStairs,
                    stairObject: s.stairObject,
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
                        },
                        elements: s.elements.map((el, i) => ({
                            element_index: el.id ?? i,
                            type: el.type,
                            points: el.points,
                            comments: el.comments,
                        })),
                    },
                ],
            }
        },

        // Hydrate store from a loaded project + floor detail
        hydrateFromServer: (project, floorDetail) => {
            const ps = project.settings || {}
            const fs = floorDetail.settings || {}
            set(() => ({
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
                isSprinklered: ps.isSprinklered ?? true,
                doorOpenings: ps.doorOpenings ?? { ...defaultDoorTimings.MOE },
                aovMode: ps.aovMode ?? "always_open",
                aovActivationTime: ps.aovActivationTime ?? null,
                obstructionTransparency: ps.obstructionTransparency ?? { stairWalls: 0.25, stairRoof: 0.25, fireFloorWalls: 0.0 },
                totalHeatFlux: ps.totalHeatFlux ?? 476,
                heatEndpoint: ps.heatEndpoint ?? 1.3333,
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
                // Elements
                elements: (floorDetail.elements || []).map(el => ({
                    id: el.element_index,
                    type: el.type,
                    points: el.points,
                    comments: el.comments,
                })),
            }))
        },

        // Reset all persisted state for a new project
        resetProject: () => {
            localStorage.removeItem('upload-canvas-fds')
            clearPdfFromIndexedDB()
            set(() => ({
                projectId: null,
                floorId: null,
                projectName: null,
                saveStatus: null,
                elements: [],
                tool: "scale",
                selectedElement: null,
                comment: "",
                canvasDimensions: {},
                pixelsPerMesh: 1,
                originPixels: null,
                convertedPoints: [],
                hasDoor: false,
                pdfData: null,
                pdfIsGreyscale: false,
                pdfCanvasRef: null,
                totalHeatFlux: 476,
                heatEndpoint: 1.3333,
                fireFloorZ: 0,
                fireFloorNumber: 0,
                numberOfStairs: 0,
                totalFloors: 8,
                stairRoofZ: 25,
                wallHeight: 3,
                topStoreyHeight: 20,
                commonCorridorMode: false,
                scenarioType: "MOE",
                simEndTime: 300,
                includeSensors: true,
                corridorSensorHeights: [2.0],
                stairSensorHeights: [0.5, 1.0, 1.5, 2.0],
                isSprinklered: true,
                doorRoles: {},
                highlightedDoorId: null,
                doorLeakagesEnabled: true,
                doorLeakageConfig: {},
                doorOpenings: { ...defaultDoorTimings.MOE },
                landingRoles: {},
                highlightedLandingId: null,
                landingUpSide: null,
                aovMode: "always_open",
                aovActivationTime: null,
                obstructionTransparency: { stairWalls: 0.25, stairRoof: 0.25, fireFloorWalls: 0.0 },
                stairObject: [],
            }))
        },
}
}, {
    name: 'upload-canvas-fds',
    partialize: (state) => ({
        projectId: state.projectId,
        floorId: state.floorId,
        projectName: state.projectName,
        elements: state.elements,
        tool: state.tool,
        canvasDimensions: state.canvasDimensions,
        pixelsPerMesh: state.pixelsPerMesh,
        comment: state.comment,
        convertedPoints: state.convertedPoints,
        originPixels: state.originPixels,
        hasDoor: state.hasDoor,
        totalHeatFlux: state.totalHeatFlux,
        heatEndpoint: state.heatEndpoint,
        fireFloorZ: state.fireFloorZ,
        fireFloorNumber: state.fireFloorNumber,
        totalFloors: state.totalFloors,
        wallHeight: state.wallHeight,
        stairRoofZ: state.stairRoofZ,
        topStoreyHeight: state.topStoreyHeight,
        numberOfStairs: state.numberOfStairs,
        stairObject: state.stairObject,
        commonCorridorMode: state.commonCorridorMode,
        scenarioType: state.scenarioType,
        simEndTime: state.simEndTime,
        includeSensors: state.includeSensors,
        corridorSensorHeights: state.corridorSensorHeights,
        stairSensorHeights: state.stairSensorHeights,
        isSprinklered: state.isSprinklered,
        doorRoles: state.doorRoles,
        doorLeakagesEnabled: state.doorLeakagesEnabled,
        doorLeakageConfig: state.doorLeakageConfig,
        doorOpenings: state.doorOpenings,
        landingRoles: state.landingRoles,
        landingUpSide: state.landingUpSide,
        aovMode: state.aovMode,
        aovActivationTime: state.aovActivationTime,
        obstructionTransparency: state.obstructionTransparency,
    }),
}))

export { defaultDoorTimings }
export default useStore