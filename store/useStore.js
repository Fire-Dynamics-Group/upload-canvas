import { create } from 'zustand'

const useStore = create((set) => {
    return {

        elements: [],
        tool: "scale",
        selectedElement: null,

        addElement: (newEl) => set((state) => ({
            elements: [...state.elements, newEl]
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
                    selectedElement: null
                }
                return {
                    tool: newTool
                }
            }
            )
        },

        setSelectedElement: (newEl) => set((state) => ({
            selectedElement: newEl
        }))
}
})

export default useStore