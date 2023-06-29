import { calcDistance } from "./helperFunctions"


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


export function returnFinalCoordinates(pixelsPerMetre, elements, originPixels, screenH) { // call from zustand?
    let final_coords = []

    for (let i=0; i < elements.length; i++) {
        let currentPoints = elements[i]["points"] // use id
        final_coords.push({"id": elements[i]["id"], "finalPoints": [], "comments": elements[i]["comments"]})
        for (let j=0; j < currentPoints.length; j++) {
            let currentP = invertYAxisOfPoint(currentPoints[j], screenH)
            currentP = {"x": ((currentP.x - originPixels.x)/pixelsPerMetre).toFixed(1), "y": ((currentP.y - originPixels.y)/pixelsPerMetre).toFixed(1)}
            final_coords[i]["finalPoints"].push(currentP)

        }
    }
    console.log("final_coords: ", final_coords)
    return final_coords // TODO: send error msg if fire or escape route not present, obstruction perhaps not required?

}

export function prepForRadiationTable(wakingSpeed, final_coords) {
    let array = []
    // TODO: get test data running
    // access comments from final_coords
    // needs to check that 
    // fire location
    console.log("final_coords: ", final_coords)
    let fire = final_coords.filter(el => el.comments === 'fire')
    let escapeRoute = final_coords.filter(el => el.comments === 'escapeRoute')
    let obstruction = final_coords.filter(el => el.comments === 'obstruction') // not always required


    let escapeRoutePoints = escapeRoute["finalPoints"]
    let firePoints = fire["finalPoints"]
    if (obstruction) {

        let obstructionPoints = obstruction["finalPoints"]
    }

    // time steps -> length along escape route/1.2 
    // additional one for end but likely less than 1 second
    // find total length of route

    /**
     * Table
     * row 1: Time,
     * 
     * time step 0 @ furthest point (1.2*0 from along escape route)
     * check if any obstructions between fire and point
        * if not; find distance to fire
        * use in calc for FED
        * if obstruction in way, FED = zero   
     *  next time step
     */
    let columns = [
                    "Time", 
                    "Distance Travelled along Escape Route (m)", 
                    "Distance from Cooker Fire (m)", 
                    "Radiative Heat Flux Received (kW/m2)", 
                    "FED Contribution From Time Step",
                    "Cumulative FED"
                ]
}

// example data below
// [
//     {
//         "id": 0,
//         "finalPoints": [
//             {
//                 "x": 0,
//                 "y": 5.206250235300577
//             },
//             {
//                 "x": 0.3003605904981104,
//                 "y": 1.9022837398213686
//             },
//             {
//                 "x": 3.50420688914462,
//                 "y": 0.8009615746616278
//             },
//             {
//                 "x": 3.8045674796427313,
//                 "y": 0
//             }
//         ],
//         "comments": "escapeRoute"
//     },
//     {
//         "id": 1,
//         "finalPoints": [
//             {
//                 "x": 6.307572400460318,
//                 "y": 0.40048078733081055
//             },
//             {
//                 "x": 4.205048266973545,
//                 "y": 0.40048078733081055
//             }
//         ],
//         "comments": "obstruction"
//     },
//     {
//         "id": 2,
//         "finalPoints": [
//             {
//                 "x": 5.806971416296799,
//                 "y": 1.9022837398213686
//             }
//         ],
//         "comments": "fire"
//     }
// ]