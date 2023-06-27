import { create } from 'zustand'

const useStore = create((set) => {
    return {

        elements: [],
        tool: "scale",
        selectedElement: null,
        currentMode: "fdsGen",
        comment: "",

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
        }))
}
})

export default useStore