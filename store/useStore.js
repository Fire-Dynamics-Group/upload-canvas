import { create } from 'zustand'

const useStore = create((set) => {
    return {

        elements: [],
        addElement: (newEl) => set((state) => ({
            elements: [...state.elements, newEl]
        })),
        removeElement: (selectedID) => set((state) => ({
            elements: state.elements.filter(element => element.id !== selectedID)
        }))
    }
})

export default useStore