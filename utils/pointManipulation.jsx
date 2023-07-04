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
            currentP = {"x": parseFloat(((currentP.x - originPixels.x)/pixelsPerMetre).toFixed(1)), "y": parseFloat(((currentP.y - originPixels.y)/pixelsPerMetre).toFixed(1))}
            final_coords[i]["finalPoints"].push(currentP)

        }
    }
    console.log("final_coords: ", final_coords)
    return final_coords // TODO: send error msg if fire or escape route not present, obstruction perhaps not required?

}

export function prepForRadiationTable(walkingSpeed, final_coords, doorOpeningTime=10) {
    // TODO: need parameter checking for doorOpeningTime etc
    let array = []
    let isObstructed = false
    let hasDoor = false // should be escape door in toolbar for clarity perhaps?

    console.log("final_coords: ", final_coords)
    let fire = final_coords.filter(el => el.comments === 'fire')[0]
    let escapeRoute = final_coords.filter(el => el.comments === 'escapeRoute')[0]
    let obstruction = final_coords.filter(el => el.comments === 'obstruction') // not always required
    let door = final_coords.filter(el => el.comments === 'door') // not always required


    let escapeRoutePoints = escapeRoute["finalPoints"]
    let firePoints = fire["finalPoints"][0]
    if (obstruction && obstruction[0]) {
        isObstructed = true

    }
    if (door && door[0]) {
        hasDoor = true
        // if door -> change ultimate final_coords to be mid point of the door
        let doorPoints = door[0]["finalPoints"]
        let doorMidPointX = parseFloat(((doorPoints[0]["x"] + doorPoints[1]["x"]) / 2).toFixed(2))
        let doorMidPointY = parseFloat(((doorPoints[0]["y"] + doorPoints[1]["y"]) / 2).toFixed(2))
        escapeRoutePoints[escapeRoutePoints.length - 1] = {"x": doorMidPointX, "y": doorMidPointY}
    }
    console.log("escapeRoutePoints: ", escapeRoutePoints, firePoints)

    // TODO: inlcude logic for door -> add x amount of seconds
    // likely fractional time and distance to door
    // easier if door always end

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
    accumulatedDistanceList.push(accumulatedDistance)
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
            // if final index => needs to add fractional time & next vertex
            if (i === maxIndex) {
                accumulatedDistanceList.push(accumulatedDistance) // is accumulated distance needed here?
                subEscapePoints.push(nextVertex)
                let currentHobDistance = calcDistance(nextVertex, firePoints)
                hobDistanceList.push(currentHobDistance)
                // add fractional time -> fraction of actualDistance / distancePerSecond
                let subDistance = timeStepDistance
                let timeFraction = subDistance / distancePerSecond
                currentTime += timeFraction
                timeArray.push(parseFloat(currentTime.toFixed(2)))
                // if has door -> add further line for door opening time
                if (hasDoor) {
                    accumulatedDistanceList.push(accumulatedDistance) // is accumulated distance needed here?
                    subEscapePoints.push(nextVertex)
                    hobDistanceList.push(currentHobDistance)
                    currentTime += Number(doorOpeningTime)
                    console.log("currentTime: ", currentTime)
                    // timeArray.push(currentTime)
                    timeArray.push(parseFloat(Number(currentTime).toFixed(2)))                                       
                }
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
    console.log("subEscapePoints: ", subEscapePoints)
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
        // (px, py, fx, fy, obst1x, obst1y, obst2x, obst2y) 
        // intersects(a,b,c,d,p,q,r,s)
        let currentP = subEscapePoints[i]
        intersection = false
        // need to loop through obstructions
        if (isObstructed) {
            for (let j = 0; j < obstruction.length; j++) { // until 1 minus
                let currentObstructionPoints = obstruction[j]["finalPoints"] // each sub vertex
                for (let k = 0; k < currentObstructionPoints.length - 1; k++) {

                    let startingObstP = currentObstructionPoints[k]
                    let endObstP = currentObstructionPoints[k + 1]
                    intersection = intersects(currentP["x"], currentP["y"], firePoints["x"], firePoints["y"], startingObstP["x"], startingObstP["y"], endObstP["x"], endObstP["y"])
                    if (intersection) break 
                }
                if (intersection) break 
            }
        }
        // add to column if intersect with obstruction lines
        let currentHobDistance = hobDistanceList[i]
        let q = (intersection) ? 0 : computeHeatFlux(currentHobDistance)
        let tolRAD = (intersection) ? 0 : radiantHeatEndpoint / (q**1.33)
        let timestepDuration = (i > 0) ? timeArray[i] - timeArray[i - 1] : 1
        let timestepFED = (intersection) ? 0 : (timestepDuration / tolRAD) / 60 // change divider depending on duration of timestep * durationTimestep/60
        accumulatedFED += timestepFED

        rows.push([
            // parseFloat(timeArray[i].toFixed(2)),
            parseFloat(timeArray[i]),
            parseFloat(accumulatedDistanceList[i].toFixed(2)),
            parseFloat(currentHobDistance.toFixed(2)),
            parseFloat(q.toFixed(2)), 
            parseFloat(timestepFED.toFixed(4)), 
            parseFloat(accumulatedFED.toFixed(4) )           
        ])
    }

    function computeHeatFlux(distance, totalHeatFlux=472, radiativeFraction=0.3333) { // was 472 // 150 
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
