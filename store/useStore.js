import { create } from 'zustand'
import {findOriginPixels, returnFinalCoordinates} from '../utils/pointManipulation'

const useStore = create((set) => {
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
        setTopStoreyHeight: (newVal) => set(() => ({
            totalFloors: newVal
        })),
        // stairRoofZ
        setStairRoofZ: (newVal) => set(() => ({
            stairRoofZ: newVal
        })),
        // topStoreyHeight
        setTopStoreyHeight: (newVal) => set(() => ({
            topStoreyHeight: newVal
        })),
}
})

export default useStore