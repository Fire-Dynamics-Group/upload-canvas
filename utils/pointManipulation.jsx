import useStore from '../store/useStore'


export default function ManipulatePoints() {
    // perhaps have this called from zustand rather than hook
    const setOriginPixels = useStore((state) => state.setOriginPixels)
    const elements = useStore((state) => state.elements)
    const canvasDimensions = useStore((state) => state.canvasDimensions)
    const pixelsPerMesh = useStore((state) => state.pixelsPerMesh)

    let canvasH = canvasDimensions.height
    // find min x & y => apply offset for origin
    //  
    let originPixels = findOriginPixels(findOriginPixels(elements), canvasH)
    let finalPoints = returnFinalCoordinates(pixelsPerMesh * 10 , elements, originPixels)
    return (<>
    </>)        
}


export function findOriginPixels(elements, screenH) { // need to be coords already!!
    let minX = null
    let minY = null
    // convert first to coords
    for (let i=0; i < elements.length; i++) {
        let currentPoints = elements[i]["points"]
        for (let j=0; j < currentPoints.length; j++) {
            let currentP = invertYAxisOfPoint(currentPoints[j], screenH)
            if (minX == null || currentP.x < minX) {
                minX = currentP.x
            }
            if (minY == null || currentP.y < minY) {
                minY = currentP.y
            }
        }
    }
    return {"x": minX, "y": minY} // that gives offset
}

function invertYAxisOfPoint(p, screenH) {
    return {"x": p.x, "y": screenH - p.y}
}


export function returnFinalCoordinates(pixelsPerMetre, elements, originPixels) { // call from zustand?
    let final_coords = []
    // all or one at a time?
    // need max height of pdf, (maxH - yCoordinate)
    // add array final_coords with index linking to element
    // pixels to metre
    // then add 
    for (let i=0; i < elements.length; i++) {
        let currentPoints = elements[i]["points"] // use id
        final_coords.append({"id": elements[i]["id"], "finalPoints": []})
        for (let j=0; j < currentPoints.length; j++) {
            let currentP = invertYAxisOfPoint(currentPoints[j], screenH)
            currentP = {"x": (currentP.x - originPixels.x)/pixelsPerMetre, "y": (currentP.y - originPixels.y)/pixelsPerMetre}
            final_coords[i]["finalPoints"].append(currentP)


        }
    }
    return final_coords

}