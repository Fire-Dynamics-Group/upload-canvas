import { create } from 'zustand'

const useStore = create((set) => {
    return {

        elements: [],
        setElements: (newEl) => set((state) => ({
            elements: [...state.elements, newEl]
        })),    
    }
})

export default useStore