import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {findOriginPixels, returnFinalCoordinates} from '../utils/pointManipulation'

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

const useStore = create(persist((set) => {
    const defaultStairObject = {"fire_floor": 0, "total_floors": 5, "stair_roof_z": 25, "top_storey_height": 21}
    return {

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
        sensorHeights: { moe: [2.0], pressure: [0.5, 1.0, 1.5, 2.0] },
        isSprinklered: true,

        // Door role assignment: { [doorId]: "apartment" | "stair" | "lobby" | "other" }
        doorRoles: {},
        highlightedDoorId: null,

        // Door leakage settings
        doorLeakagesEnabled: true,
        doorLeakageConfig: {}, // per-door: { [doorId]: { enabled: true, sealType: "non-smoke-sealed" } }

        // Door openings - defaults per scenario type
        doorOpenings: { ...defaultDoorTimings.MOE },

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
        setSensorHeights: (newVal) => set(() => ({
            sensorHeights: newVal
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
}
}, {
    name: 'upload-canvas-fds',
    partialize: (state) => ({
        elements: state.elements,
        pixelsPerMesh: state.pixelsPerMesh,
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
        sensorHeights: state.sensorHeights,
        isSprinklered: state.isSprinklered,
        doorRoles: state.doorRoles,
        doorLeakagesEnabled: state.doorLeakagesEnabled,
        doorLeakageConfig: state.doorLeakageConfig,
        doorOpenings: state.doorOpenings,
    }),
}))

export { defaultDoorTimings }
export default useStore