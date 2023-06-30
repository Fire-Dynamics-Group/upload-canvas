import { calcDistance, intersects } from "./helperFunctions"
import * as XLSX from 'xlsx';


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

export function prepForRadiationTable(walkingSpeed, final_coords) {
    let array = []
    let isObstructed = false

    console.log("final_coords: ", final_coords)
    let fire = final_coords.filter(el => el.comments === 'fire')[0]
    let escapeRoute = final_coords.filter(el => el.comments === 'escapeRoute')[0]
    let obstruction = final_coords.filter(el => el.comments === 'obstruction') // not always required


    let escapeRoutePoints = escapeRoute["finalPoints"]
    let firePoints = fire["finalPoints"][0]
    if (obstruction && obstruction[0]) {
        isObstructed = true
        // could be more than one obstruction!!
        let obstructionPoints = obstruction[0]["finalPoints"]
    }
    console.log("escapeRoutePoints: ", escapeRoutePoints, firePoints)

    // time steps -> length along escape route/1.2 
    // additional one for end but likely less than 1 second
    // find total length of route
    // find 1.2m sections along route
    let subEscapePoints = [] // location of escapee in one second intervals
    let timeArray = []
    let hobDistanceList = []
    let accumulatedDistanceList = []
    subEscapePoints.push(escapeRoutePoints[0])
    hobDistanceList.push(calcDistance(escapeRoutePoints[0], firePoints))
    let currentTime = 0
    timeArray.push(currentTime)

    let accumulatedDistance = 0 // total distance along route
    let timeStepDistance = 0 // returns to zero each 1.2m
    let distancePerSecond = walkingSpeed
    let maxIndex = escapeRoutePoints.length - 2
    for (let i = 0; i < maxIndex + 1; i++) {
        let currentVertex = escapeRoutePoints[i]
        let nextVertex = escapeRoutePoints[i+1]
        // find distance between point and next 1
        let deltaVertices = calcDistance(currentVertex, nextVertex)
        let remainingDeltaVertices = deltaVertices
        let deltaVerticesX = nextVertex["x"] - currentVertex["x"] // move out of while loop
        let deltaVerticesY = nextVertex["y"] - currentVertex["y"]

        while ((remainingDeltaVertices + timeStepDistance) > distancePerSecond) { // should be a while loop
            // find point where distancePerSecond - timeStepDistance = subDistance

            let startingDistance = deltaVertices - remainingDeltaVertices
            let startingFraction = startingDistance / deltaVertices
            let startingDeltaX = deltaVerticesX * startingFraction
            let startingDeltaY = deltaVerticesY * startingFraction

            var targetDelta = distancePerSecond - timeStepDistance
            let targetDeltaFractionAlongSegment = targetDelta / deltaVertices
            let targetDeltaX = deltaVerticesX * targetDeltaFractionAlongSegment 
            let targetDeltaY = deltaVerticesY * targetDeltaFractionAlongSegment 
            let subP = {"x": currentVertex["x"] + targetDeltaX + startingDeltaX, "y": currentVertex["y"] + targetDeltaY + startingDeltaY}
            // add point
            subEscapePoints.push(subP)
            hobDistanceList.push(calcDistance(subP, firePoints))
            currentTime += 1
            timeArray.push(currentTime)
            
            // add targetDelta to accumulatedDistance & reset timeStepDistance = 0 
            timeStepDistance = 0
            accumulatedDistance += targetDelta
            accumulatedDistanceList.push(accumulatedDistance)
            remainingDeltaVertices -= targetDelta

        } 
        // else add deltaVertice to accumulated
        if ((remainingDeltaVertices + timeStepDistance) < distancePerSecond) {
            // break without adding new points
            // add delta vertice to accumulated; timestepdistance carries over
            timeStepDistance += remainingDeltaVertices + timeStepDistance
            accumulatedDistance += remainingDeltaVertices + timeStepDistance
            accumulatedDistanceList.push(accumulatedDistance)
            // if final index => needs to add fractional time & next vertex
            if (i === maxIndex) {
                subEscapePoints.push(nextVertex)
                hobDistanceList.push(calcDistance(nextVertex, firePoints))
                // add fractional time -> fraction of actualDistance / distancePerSecond
                let subDistance = timeStepDistance
                let timeFraction = subDistance / distancePerSecond
                currentTime += timeFraction
                timeArray.push(currentTime.toFixed(2))                
            }
        } else if ((remainingDeltaVertices + timeStepDistance) == distancePerSecond) {
            // add points & move to next
            // add delta vertice to accumulated
            subEscapePoints.push(nextVertex)
            hobDistanceList.push(calcDistance(nextVertex, firePoints))
            currentTime += 1
            timeArray.push(currentTime)
            timeStepDistance = 0
            accumulatedDistance += distancePerSecond
            accumulatedDistanceList.push(accumulatedDistance)
        } 
    }
    let FED = []
    let accumulatedFED = 0
    let intersection = false
    let rows = []
    let columns = [
        "Time", 
        "Distance Travelled along Escape Route (m)", 
        "Distance from Cooker Fire (m)", 
        "Radiative Heat Flux Received (kW/m2)", 
        "FED Contribution From Time Step",
        "Cumulative FED"
    ]
    rows.push(columns)
    let radiantHeatEndpoint = 1.3333
    for (let i = 0; i < subEscapePoints.length; i++) {
        // add to column if intersect with obstruction lines
        let currentHobDistance = hobDistanceList[i]
        let q = (intersection) ? 0 : computeHeatFlux(currentHobDistance)
        let tolRAD = (intersection) ? 0 : radiantHeatEndpoint / (q**1.33)
        let timestepFED = (intersection) ? 0 : (1 / tolRAD) / 60
        accumulatedFED += timestepFED

        // rows.push({
        //     "time":timeArray[i] ,
        //     "accumulatedDistance": accumulatedDistance[i] ,
        //     "hobDistance": currentHobDistance.toFixed(2),
        //     "q": q.toFixed(2), 
        //     "timestepFED": timestepFED.toFixed(2), 
        //     "accumulatedFED": accumulatedFED.toFixed(2)
        // })
        rows.push([
            timeArray[i] ,
            accumulatedDistanceList[i].toFixed(2),
            currentHobDistance.toFixed(2),
            q.toFixed(2), 
            timestepFED.toFixed(4), 
            accumulatedFED.toFixed(4)            
        ])
    }

    function computeHeatFlux(distance, totalHeatFlux=482, radiativeFraction=0.3333) {
        return totalHeatFlux * radiativeFraction / (4 * Math.PI * distance ** 2)
    }
    // download to spreadsheet
    if (rows) {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
        // download workbook
        XLSX.writeFile(wb, `radiationFED@${walkingSpeed}.xlsx`);

      }
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