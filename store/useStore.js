import { create } from 'zustand'
import {findOriginPixels, returnFinalCoordinates} from '../utils/pointManipulation'

const useStore = create((set) => {
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

        setHasDoor: (newBool) => set(() => ({
            hasDoor: newBool
        })),

}
})

export default useStore