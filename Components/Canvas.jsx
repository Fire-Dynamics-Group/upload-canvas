import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Gridlines from './Gridlines'
import ScalePopup from './ScalePopup'
import FDRobot from './FDRobot'
import { CSVLink } from 'react-csv'
import useStore from '../store/useStore'
import { calcDistance } from '@/utils/helperFunctions'
import { get } from 'http'

/**
 * 
 * TODO: have indication the mesh aligned with other mesh -> only colour subsections of mesh edge that align
 * bug: addiitonal meshes added when mesh changed size
 * 
 * 
 * bug: only allowing top left and bottom right for rect changing size
*/
const elementConfig = {
    "obstruction": "green",
    "mesh": "green",
    "stairObstruction": "blue",
    "stairMesh": "blue",
    "door": "red",
    "fire": "orange",
    "scale": "green",
    "selection": "orange",
    "escapeRoute": "blue",
    "opening": "blue"
}

// eslint-disable-next-line react/prop-types
function Canvas({dimensions, isDevMode}) {
    // TODO: have currentElement array with {} including type etc like elements
    const [currentPoly, setCurrentPoly] = useState([])
    const [currentRect, setCurrentRect] = useState([])
    const [currentPoint, setCurrentPoint] = useState([])

    const elements = useStore((state) => state.elements)
    const addElement = useStore((state) => state.addElement)
    const removeElement = useStore((state) => state.removeElement)
    const changeElement = useStore((state) => state.changeElement)
    const comment = useStore((state) => state.comment)
    const setComment = useStore((state) => state.setComment)
    const currentMode = useStore((state) => state.currentMode)


    const [isDrawing, setIsDrawing] = useState(false)
    
    // TODO: have a keyPressed useState -> with which key
    const [isUpPressed, setIsUpPressed] = useState(false)

    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    const [isEscapePressed, setIsEscapePressed] = useState(false)
    // on enter -> isDrawing = false
    // add polyline to state
    // add type of line -> include in useLayoutEffect canvas rendering
    const [isEnterPressed, setIsEnterPressed] = useState(false)
    const canvasRef = useRef(null)
    // const pixelsPerMesh = 10 // calc from scale
    // const [pixelsPerMesh, setPixelsPerMesh] = useState(1)
    const pixelsPerMesh = useStore((state) => state.pixelsPerMesh)
    const setPixelsPerMesh = useStore((state) => state.setPixelsPerMesh)

    const [hasScale, setHasScale] = useState(false)
    const [scalePoints, setScalePoints] = useState([])
    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height
    // TODO: if drawing have line between penultimate point and cursor
    // have state that is true when drawing is true and mouse moving -> store mouse
    const [guideLine, setGuideLine] = useState(null)
    const [currentId, setCurrentId] = useState(0)
    const [xCounter, setXCounter] = useState(0)
    const [yCounter, setYCounter] = useState(0)

    // below logic for popup
    const [showPopup, setShowPopup] = useState(false)
    const [scaleDistance, setScaleDistance] = useState(null)
    const selectedElement = useStore((state) => state.selectedElement)
    const setSelectedElement = useStore((state) => state.setSelectedElement)

    const beingEditedElement = useStore((state) => state.beingEditedElement)
    const nullSelectedAndEditedElements = useStore((state) => state.nullSelectedAndEditedElements)


    const tool = useStore((state) => state.tool)
    const setTool = useStore((state) => state.setTool)


    console.log("scaleDistance: ", scaleDistance)      

    // useCallback return memoized version of function -> only changes if dep val changes
    // therefore, not re-ran each re-render of useEffect
    const returnElementObject = useCallback((type, pointsArray, comments) => {
        let id = currentId 
        setCurrentId(prev => prev + 1)
        return {
            "type": type,
            "points": pointsArray,
            "comments": comments,
            "id": id,
            // "beingEdited": false // not rendered from elements if true -> editedElement in current logic e.g. currentPoly etc
        }          
    }, [currentId])
    // event listener for ctrl button
    // lines to be ortho -> check if closer to x or y ortho
    // LATER: move keypress to own component -> send back keys pressed or keyup
    useEffect(() => {


        const handleKeyPress = ({key}) => {
            // have arrow keys for controlling element location
            if (key == 'ArrowUp') {
                event.preventDefault();
                setIsUpPressed(true)
            }        
            if (key == 'Control') {
                setIsCtrlPressed(true)
            }
            if (key == 'Escape') {
                setIsEscapePressed(true)
                
                if (selectedElement && selectedElement["element"]) {
                    console.log("key: ", key, selectedElement["element"])
                    // remove selected element from elements
                    let selectedId = selectedElement["element"]["id"]
                    // console.log("filtered element: ", elements.filter(element => element.id !== selectedId))
                    removeElement(selectedId); // filter returns array of all items meeting condition
                    setSelectedElement(null)
                }
            }
            // "Enter"
            if (key == 'Enter') {
                function addElementToState() {
                    // only needed for polyline?
                    if (tool == 'polyline') {
                        // if selection == true; then finalise position
                        if (currentPoly.length > 0 ) {
                            let current_el = returnElementObject(tool, currentPoly, comment)
                            addElement(current_el)
                            
                        }
                        // actions when first one drawn -> will guide be removed?
                        setIsDrawing(false)
                        setCurrentPoly([])
                    } 
                }

                // action adding polyline to state if applicable
                // clear current poly
                // comments to be added from user selection of drop down
                addElementToState()
                setIsEnterPressed(true)
                
              }
        };
        const handleCtrlRelease = ({key}) => {
            // console.log("keyup event: ",key)
            if (key == 'Control') {
                setIsCtrlPressed(false)
            }
            if (key == 'Escape') {
                setIsEscapePressed(false)
            }
            // "Enter"
            if (key == 'Enter') {
                setIsEnterPressed(false)
                }
        };

        window.addEventListener("keydown", handleKeyPress)
        window.addEventListener("keyup", handleCtrlRelease)

        return () => {
            window.removeEventListener("keydown", handleKeyPress)
            window.removeEventListener("keyup", handleCtrlRelease)
        }
    }, [elements, currentPoly, tool, setTool, comment, addElement, selectedElement, currentId, removeElement, returnElementObject, setSelectedElement])

    // LATER: move to own component -> sends back null or position object
    useEffect(() => {
        // TODO: guide rect for meshes
        const handleMouseMove = (event) => {
            // currentElement should have type and can include scale
            if (selectedElement || isDrawing && currentPoly.length > 0 || tool === 'scale' && scalePoints.length == 1 || tool === 'rect' && currentRect.length == 1) { // and tool == polyline
                event.preventDefault();
                setGuideLine({x: event.pageX, y: event.pageY})
            } else {
                setGuideLine(null)
            }
        };

        window.addEventListener("mousemove", handleMouseMove)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
        }
    }, [isDrawing, currentPoly, scalePoints.length, tool, currentRect, selectedElement])

    function deltaGridlines(pxPerMesh, tool) { // actioned if debug mode and after scale set normally
        setPixelsPerMesh(pxPerMesh)
        setHasScale(true)
        setShowPopup(false)
        // change from scale mode to drawing mode
        setTool(tool)
        setComment("obstruction")
    }

    function handleScaleInput(inputDistance) {
        let scaleDistance = inputDistance
        let desiredScale = 0.1 //m - later be changeable
        let pixels = calcDistance(scalePoints[0], scalePoints[1])
        let temp = pixels / (scaleDistance / desiredScale)
        console.log("pxPerMesh: ", pixels/scaleDistance)
        deltaGridlines(temp, 'polyline')
    }
 
    useLayoutEffect(() => {
        // TODO: render selectedElement
        console.log("elements: ", elements)
        // TODO: need to add finished polygon or points to object array
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        context.clearRect(0, 0, canvas.width, canvas.height)

        function linesSharePoint(line1Start, line1End, line2Start, line2End) {

            let line1minX = Math.round(Math.min(line1Start.x, line1End.x))
            let line1maxX = Math.round(Math.max(line1Start.x, line1End.x))
            let line1minY = Math.round(Math.min(line1Start.y, line1End.y))
            let line1maxY = Math.round(Math.max(line1Start.y, line1End.y))

            let line2minX = Math.round(Math.min(line2Start.x, line2End.x))
            let line2maxX = Math.round(Math.max(line2Start.x, line2End.x))
            let line2minY = Math.round(Math.min(line2Start.y, line2End.y))
            let line2maxY = Math.round(Math.max(line2Start.y, line2End.y))

            // TODO: return point of central intersection -> or colour lines?
            if (line1minY === line1maxY && line1maxY === line2minY && line2minY === line2maxY) {
                if (line1minX <= line2minX && line1maxX >= line2minX || line2minX <= line1minX && line2maxX >= line1minX) {
                    return true
                }
                if (line1minX <= line2maxX && line1maxX >= line2maxX || line2minX <= line1maxX && line2maxX >= line1maxX) {
                    return true
                }

            } 
            if (line1minX === line1maxX && line1maxX === line2minX && line2minX === line2maxX) {

                if (line1minY <= line2minY && line1maxY >= line2minY || line2minY <= line1minY && line2maxY >= line1minY) {
                    return true
                }
                if (line1minY <= line2maxY && line1maxY >= line2maxY || line2minY <= line1maxY && line2maxY >= line1maxY) {
                    return true
                }
            }

            return false
        }
        function areListsDifferent(list1, list2) {
            // Check if lists have different lengths
            if (list1.length !== list2.length) {
                return true;
            }
        
            for (let i = 0; i < list1.length; i++) {
                const obj1 = list1[i];
                const obj2 = list2[i];
        
                // Compare lengths of the x arrays
                if (obj1.x.length !== obj2.x.length) {
                    return true;
                }
        
                // Compare lengths of the y arrays
                if (obj1.y.length !== obj2.y.length) {
                    return true;
                }
        

                    if (Math.round(obj1.x) !== Math.round(obj2.x)) {
                        return true;
                    }


                    if (Math.round(obj1.y) !== Math.round(obj2.y)) {
                        return true;
                    }

            }
        
            return false;
        }
        
        // TODO: have indication if two meshes aligned -> perhaps a cross?
        function isMeshAligned(currentPoints, elements) { // probably finished shapes only
            // check if currentPoints align with any meshElements
            let currentCorners = getRectCorners(currentPoints)
            for (let i = 0; i < currentCorners.length; i++) {
                let currentStart = currentCorners[i]
                let currentEnd = currentCorners[(i+1)%4]
                for (let j = 0; j < elements.length; j++) {
                    if (isMesh(elements[j])) {
                        // all 4 sides of mesh
                        let checkCorners = getRectCorners(elements[j]["points"])
                        // check not the same element
                        if (areListsDifferent(checkCorners, currentCorners)) {
                            for (let k = 0; k < checkCorners.length; k++) {
                                let checkStart = checkCorners[k]
                                let checkEnd = checkCorners[(k+1)%4]
                                console.log("checking alignment")
                                // check if any of the sides align
                                if (linesSharePoint(currentStart, currentEnd, checkStart, checkEnd)) {
                                    return {"isAligned":true, keyPoints: [currentStart, currentEnd, checkStart, checkEnd]}; // need side that aligns
                                    // later only return subsection that overlaps the other line
                                }
                            }

                        }
                    }
                }
            }
            return {"isAligned":false, keyPoints: null}
        }

        function drawRect(points, context, comments, dotted=false) {
            let p1 = points[0]
            let p2 = points[1]
            let deltaX = p2.x - p1.x
            let deltaY = p2.y - p1.y
            context.strokeStyle = elementConfig[comments] 
            context.lineWidth = 1.5;
            if (dotted) {
                context.setLineDash([5, 15])
                context.lineWidth = 2;
            }
            context.strokeRect(p1.x, p1.y, deltaX, deltaY)

            context.lineWidth = 1;
            context.setLineDash([])


        }

        function drawRectAndGuide(points, context, comments, dotted=true) { 
            // need if beingEdited
            console.log("selectedElement and guideLine: ",selectedElement, guideLine)
            if (selectedElement) {
                // change polypoints before drawing
                // if beingEdited
                // use guideLine for selectedPoint
                
                
                // TODO: overule mouse move if one of wasd are pressed 
                let startingPointPosition = selectedElement["pointerDown"]
                if (guideLine != null) {
                    let current = guideLine
                    // bug: top right and bottom left corners change whilst mouse is close to corner but not after that??
                    // below get 4 corners of rect
                    // then offset corners accordingly to mouse movement
                    // before sending back top left and bottom right corners to be drawn
                    let rectPoints = getRectCorners(points)
                    // if wasd pressed: offset by one cell in appropriate direction
                    let isWasdPressed = true
                    let offsetPoints
                    if (isWasdPressed) {
                        // how much is one cell: test up
                        setXCounter(prev => prev + 1)
                        offsetPoints = addOffsetToRectPoints(rectPoints, 0, 100, startingPointPosition.x, startingPointPosition.y)

                    } else {

                        offsetPoints = addOffsetToRectPoints(rectPoints, current.x - startingPointPosition.x, current.y - startingPointPosition.y, startingPointPosition.x, startingPointPosition.y)
                    }
                    points = offsetPoints
                }
                drawRect(points, context, comments, dotted)

            } else {
                // unclear when guidline would not be null and not selectedElement - when drawing and not in state yet
                let rectPoints = getRectCorners(points)
                points = [rectPoints[0], rectPoints[2]]
                drawRect(points, context, comments, dotted)

                if (guideLine != null) {
                    // line from last rect point to guideline
                    let prev = points[points.length-1]
                    let current = guideLine
                    // check if current is maxX, minX, maxY, minY
                    if (isCtrlPressed){
                        current = snapVertexOrtho(current, prev)
                    }
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()            
                }

            }
        }

        function drawPolyline(points, context, comments) {
            console.log("polyline inputs: ",points, context, comments)
            // TODO: have all the options in an object, not just colours
            for (let i=0; i<points.length; i++) {
                // draw vertex
                if (currentMode === 'fdsGen' || comments === 'fire') {

                    let dimension = 10
                    // bug when fire point selected and shifted
                    // no comments available
                    console.log("comments: ", comments, elementConfig[comments])
                    context.fillStyle = elementConfig[comments] // have config depending on comment
                    context.fillRect(points[i].x - dimension/2, points[i].y - dimension/2, dimension, dimension)  
                }
    
                // if i> 0 draw lines between points
                if (i == 0){
                context.beginPath()}
                if (i > 0) {
                    let prev = points[i-1]
                    let current = points[i]
                    context.strokeStyle = (currentMode === 'fdsGen') ? 'black' : elementConfig[comments] // depending on mode if radiation use comment for optionsObject
                    context.lineWidth = (currentMode === 'fdsGen') ? 1 : 4; // depending on mode if radiation use 2 else 1
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()
                }
    
            }            
        }
        function drawPolyAndGuide(poly, comment, context) {
                    
            // need if beingEdited
            console.log("selectedElement and guideLine: ",selectedElement, guideLine)
            if (selectedElement) {
                // change polypoints before drawing
                // if beingEdited
                // use guideLine for selectedPoint
                // 
                let startingPointPosition = selectedElement["pointerDown"]
                if (guideLine != null) {
                    let current = guideLine
                    for (let i = 0; i < poly.length; i++) {
                        let point = poly[i]
                        if (point == startingPointPosition) {
                            poly[i].x = current.x
                            poly[i].y = current.y 
                        }
                    }
                }
                drawPolyline(poly, context, comment)

            } else {
                drawPolyline(poly, context, comment)

                if (guideLine != null) {
                    // line from last polypoint to guideline
                    let prev = poly[poly.length-1]
                    let current = guideLine
                    if (isCtrlPressed){
                        current = snapVertexOrtho(current, prev)
                    }
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()            
                }

            }
        }
        if (selectedElement) {
            // draw dashed box around element
            let selectedPoints = selectedElement["element"]["points"]
            let selectedType = selectedElement["element"]["type"]
            let rectOutlinePoints = (selectedType === 'rect') ? selectedPoints : [selectedElement["pointerDown"]]
            console.log("selPoints useLayout: ", selectedElement["pointerDown"])
            // if mesh/rect then needs to use delta for max and min y
            // find points
            let maxX = null
            let minX = null
            let maxY = null
            let minY = null

            if (selectedType === 'rect') {
                rectOutlinePoints = getRectCorners(rectOutlinePoints)
            }
            // find bottom left, right, top left and right
            for (let i = 0; i < rectOutlinePoints.length; i++) {
                let currentX = rectOutlinePoints[i].x
                let currentY = rectOutlinePoints[i].y
                if (maxX == null || maxX < currentX) {
                    maxX = currentX
                }
                if (maxY == null || maxY < currentY) {
                    maxY = currentY
                }
                if (minX == null || minX > currentX) {
                    minX = currentX
                }
                if (minY == null || minY > currentY) {
                    minY = currentY
                }                
            }

            console.log("mins: ",maxX, maxY, minX, minY)
            let buffer = 10
            maxX += buffer
            maxY += buffer
            minX -= buffer
            minY -= buffer
            // add buffer
            // draw dotted line rect
            let selectedRectPoints = [{"x": maxX, "y": maxY}, {"x": minX, "y": minY}]
            let comments = "selection"
            drawRect(selectedRectPoints, context, comments, true)

            // draw intermediate for selected shape
            // let selectedType = selectedElement["element"]["type"]

            // need to setComment when selection
            if (selectedType === 'polyline') {
                drawPolyAndGuide(selectedPoints, comment, context)
            } else if (selectedType === 'point'){
                // should use guide
                drawPolyAndGuide(selectedPoints, "fire", context)
                // drawPolyline(selectedPoints, context,"fire") // should just add to state
            } else if (selectedType == 'rect') {

                console.log("rect drawing: ", selectedElement)
                drawRectAndGuide(selectedPoints, context, comment)

                
        //     if (selectedElement["element"]["type"] === 'polyline') {
        //         drawPolyAndGuide(currentPoly, comment)
        //     // later have contrasting colour
        }
    }

        // loop through current polypoints
        if (isDrawing) {

                // should be current element with type and points object
                // logic should allow guide to not be final point

                console.log("hits here")
                
                if (tool === 'polyline') {
                    drawPolyAndGuide(currentPoly, comment, context)
                // } else if (selectedElement) {
                //     drawPolyAndGuide(selectedElement["element"]["points"], tool)
                }else if (tool === 'scale') {
                    // without context in this case!!
                    drawPolyAndGuide(scalePoints, tool, context)
                } else if (tool === 'point'){
                    drawPolyline(currentPoint, context, comment) // should just add to state
                } else if (tool == 'rect') {
                    console.log("rect drawing: ", currentRect)
                    if (currentRect.length == 1) {
                        // use guide for mousePosition
                        if (guideLine != null) {

                            // have guide point for rect -> send to draw rect
                            // likely need to add offset to rect points
                            // get rect corners first etc
                            let rectPoints = [currentRect[0], guideLine]
                            drawRect(rectPoints, context, comment)
                        }
                    }
                }

        }

        // all historical elements
        // later have different logic for different line types
        elements.forEach(element => {
            if (!selectedElement ||selectedElement && element.id != selectedElement.id) { // if element is selected -> include in current poly etc

                // later access comment -> different line colour etc
                if (element.type == 'polyline' || element.type == 'scale') {   
                    drawPolyline(element.points, context, element.comments)
                } else if (element.type == 'rect') {
                    // TODO: check if mesh aligns with other mesh edges -> perhaps a cross? or colour change edge
                    drawRect(element.points, context, element.comments)
                                // signal if mesh is aligned with other mesh
            // console.log("checking alignment")
            if (isMesh(element)) { 
                let alignedObject = isMeshAligned(element.points, elements)
                if (alignedObject["isAligned"]) { 
                    console.log("is aligned")
                    // draw cross
                    let keyPoints = alignedObject["keyPoints"]
                    let p1 = keyPoints[0]
                    let p2 = keyPoints[1]
                    let p3 = keyPoints[2]
                    let p4 = keyPoints[3]
                    context.strokeStyle = "red"
                    context.beginPath()
                    context.moveTo(p1.x, p1.y)
                    context.lineTo(p2.x, p2.y)
                    context.strokeStyle = "yellow"
                    context.moveTo(p3.x, p3.y)
                    context.lineTo(p4.x, p4.y)
                    context.stroke()
                }
            }
                    console.log("useLayoutRect: ", element.points)
                } else if (element.type == 'point') {
                    drawPolyline(element.points, context, element.comments)
                }
            }
        })

    }, [currentPoly, guideLine, isCtrlPressed, isDrawing, elements, scalePoints, tool, currentRect, currentPoint, comment, selectedElement, currentMode])

    function isMesh(currentEl) {
        if (currentEl["comments"].toLowerCase().includes("mesh")) {                       
            return true
        }        
        return false
    }

    function getRectCorners(rectPoints) {
        // works when first point is top left
        let p1 = rectPoints[0]
        let p3 = rectPoints[1]
        let p2 = {"x":p1.x, "y": p3.y}
        let p4 = {"x":p3.x, "y": p1.y}
        let topLeft, bottomLeft, bottomRight, topRight = null
        if (p1.x > p3.x) {
            if (p1.y > p3.y) {
                topLeft = p1
                bottomRight = p3
                topRight = p4
                bottomLeft = p2
            } else {
                topLeft = p2
                bottomRight = p4
                topRight = p3
                bottomLeft = p1
            
            }
        } else {
            if (p1.y > p3.y) {
                topLeft = p4
                bottomRight = p2
                topRight = p1
                bottomLeft = p3
            } else {
                topLeft = p3
                bottomRight = p1
                topRight = p2
                bottomLeft = p4
            }
        }
        // return top left, bottom left, bottom right, top right
        return [topLeft, bottomLeft, bottomRight, topRight]
    }

    function snapVertexOrtho(vertex, prevVertex) {
        // check if diff is greater in x or y between vertices
        const deltaX = Math.abs(prevVertex.x - vertex.x)
        const deltaY = Math.abs(prevVertex.y - vertex.y)

        if (deltaX < deltaY) {
            vertex.x = prevVertex.x
        } else {
            vertex.y = prevVertex.y
        }
        return vertex

    }
    function snapVertexToGrid(vertex) {
        if (currentMode === 'radiation') return vertex
        // snap to grid using pixels per mesh -> use 1
        vertex.x = (Math.round(vertex.x / pixelsPerMesh)) * pixelsPerMesh
        vertex.y = (Math.round(vertex.y / pixelsPerMesh)) * pixelsPerMesh

        return vertex
    }
    //   TODO: polyline and mark point tools
    function handlePointerDown(event) { // should this be handle mouse down?
        // event.preventDefault(); 
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (tool === 'point') {
            context.fillStyle = 'blue'

            let dimension = 5

            let newP = {x: event.pageX, y: event.pageY}
            newP = snapVertexToGrid(newP)
            let currentEl = returnElementObject(tool, [newP], comment) // comment from props
            // setElements(prev => [...prev, currentEl])
            addElement(currentEl)
            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        }
        else if (tool === 'polyline') {
            if (comment === 'door') {
                if (currentPoly.length < 2) {
                    let prevIndex = currentPoly.length
                    setIsDrawing(true) 
                    let dimension = 10
                    context.fillStyle = elementConfig["door"]
                    // // draw vertex
                    let newP = {x: event.pageX, y: event.pageY}
                    // if ctrl pressed -> next point ortho
                    if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                        newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                    }
                    newP = snapVertexToGrid(newP)
                    context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension) 
                    if (prevIndex === 1) {
                        // add element 
                        // reset currentPoly
                        let current_el = returnElementObject(tool, [currentPoly[0], newP], comment)
                        addElement(current_el)
                        setIsDrawing(false)
                        setCurrentPoly([])
                    } else {
                        setCurrentPoly((prev) => [...prev, newP])
                    }    
                }
            } else {
                setIsDrawing(true) 
                // draw vertex
                let dimension = 10
                context.fillStyle = 'green'
                let newP = {x: event.pageX, y: event.pageY}
                // if ctrl pressed -> next point ortho
                if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                    newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                }
                newP = snapVertexToGrid(newP)
                context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)  
                // add point to currentPoly
                setCurrentPoly((prev) => [...prev, newP])
                // 
            }
        } else if(tool === 'rect') {
            setIsDrawing(true)
            context.fillStyle = 'blue'

            let dimension = 5

            let newP = {x: event.pageX, y: event.pageY}
            if (currentRect.length == 0) {
                newP = snapVertexToGrid(newP)

                // on first point
                    // add first point to state
                    // guidelines of rect
                setCurrentRect([newP])
            } else if (currentRect.length > 0){
            // on second point
            // newP = snapVertexOrtho(newP, currentRect[0])
                // snap to grid
                newP = snapVertexToGrid(newP)

                let pointsArray = [currentRect[0], newP]
                // add to elements state
                let currentEl = returnElementObject(tool, pointsArray, comment) // comment from props
                addElement(currentEl)
                // set current rect to []
                setCurrentRect([])
                setIsDrawing(false)
            }

            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        } else if (tool === 'selection') {
            // need mouse location
            let pointer = {x: event.pageX, y: event.pageY}
            // find closest point of all elements
            let closestPoint = null
            let closestDistance = null
            let closestElement = null
            for (let i = 0; i < elements.length; i++) {
                let currentEl = elements[i]
                // loop through elements
                // initially allow movement of entire shape only
                let currentPoints = currentEl.points
                
                // requires to loop through all points in element 
                if (currentPoints) {
                    // needs further points for rect
                    if (currentEl["comments"].toLowerCase().includes("mesh")) {                       
                        currentPoints = getRectCorners(currentPoints)
                        console.log("p's:", currentPoints)
                    }
                    for (let j = 0; j < currentPoints.length; j++) {
                        let currentP = currentPoints[j]
                        let currentDistance = calcDistance(pointer, currentP)
                        console.log("currentP: ", currentP, j, currentDistance)
                        console.log("currentPoints.length: ", currentPoints.length)
                        //-> check what is closest shape and 
                        // find distance
                        // TODO: add threshold of certain pixels
                        // check within certain threshold close enough
                        if (currentDistance < 40 && closestDistance === null || currentDistance < closestDistance) {
                            closestDistance = currentDistance
                            closestPoint = currentP
                            closestElement = currentEl    
                        }
    
                        // LATER: allow manipulation of corners for mesh and individual points for polyline
                        // returns closest element to mouse pointer
                        
                    }
                }
            if (closestDistance) {
                // TO be user tested if pointerDown location or location of closestPoint more useful
                // TODO: moving rect should resize shape, not move shape
                setSelectedElement({"element": closestElement, "pointerDown": closestPoint})
                // setComment(closestElement["type"]) 
                // add to current - directly render from useLayout effect
                // let elType = closestElement["type"]
                
                
            } else {
                setSelectedElement(null)
                // setComment(null)
            }
            event.preventDefault();
            }



        } else if (tool === 'scale') {
            if (scalePoints.length < 2) {
                // if (scalePoints.length == 1) {
                    
                // }
                let prevIndex = scalePoints.length
                setIsDrawing(true) // drawing set to false on press of enter or return to origin
                let dimension = 10
                context.fillStyle = 'red'
                let newP = {x: event.pageX, y: event.pageY}
                // if ctrl pressed -> next point ortho
                if (isCtrlPressed && currentPoly.length > 0) { // and not first point
                    newP = snapVertexOrtho(newP, currentPoly[currentPoly.length-1])
                }
                newP = snapVertexToGrid(newP)
                context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)  
                // add point to currentPoly
                setScalePoints((prev) => [...prev, newP]) 
                // hopefully second point has registered
                if (prevIndex == 1) {
                    // action pop up
                    setShowPopup(true)
                }

            }
            // else allow to restart scale process
        }
    }
    function isRect(el) {
        if (el["type"] === 'rect') {
            return true
        }
        return false
    }
    function addOffsetToRectPoints(rectPoints, offsetX, offsetY, startingX, startingY) {
        for (let i = 0; i < rectPoints.length; i++) {
            let point = rectPoints[i]
            if (point.x == startingX && point.y == startingY) {
                // if bottom left -> change top left in x and bottom right in y
                // if top right -> change bottom right in x and top left in y
                // if top left or bottom right; change only that point
                // works when first point is top left
                let pointX = point.x + offsetX
                let pointY = point.y + offsetY
                rectPoints[i].x = pointX
                rectPoints[i].y = pointY
                rectPoints[((i-1)+4)%4].x += offsetX
                rectPoints[((i+1)+4)%4].y += offsetY
            }

        }
        return [rectPoints[0], rectPoints[2]]
    }
    function handlePointerUp(event){
        // event.preventDefault(); 
        console.log("pointerUP")
        let pointer = {x: event.pageX, y: event.pageY}
        if (selectedElement) {
            let el = selectedElement["element"] // needs id added to state
            let elementId = el["id"]
            let startingPointPosition = selectedElement["pointerDown"]
            // should be amount of times wasd clicked if this had been the case
            // let yCounter = 1
            // let xCounter = 0

            // TODO: use one cells distance
            let offsetY = 10*yCounter 
            let offsetX = 10*xCounter
            // let offsetX = pointer.x - startingPointPosition.x
            // let offsetY = pointer.y - startingPointPosition.y
            // if rect need to include corners too!
            if (isRect(el)) {
                let rectPoints = getRectCorners(el.points) // returns points in order of top left, bottom left, bottom right, top right
                for (let i = 0; i < rectPoints.length; i++) {
                    let point = rectPoints[i]
                    if (point.x == startingPointPosition.x && point.y == startingPointPosition.y) {
                        // if bottom left -> change top left in x and bottom right in y
                        // if top right -> change bottom right in x and top left in y
                        // if top left or bottom right; change only that point
                        // works when first point is top left
                        let pointX = point.x + offsetX
                        let pointY = point.y + offsetY
                        rectPoints[i].x = pointX
                        rectPoints[i].y = pointY
                        rectPoints[((i-1)+4)%4].x += offsetX
                        rectPoints[((i+1)+4)%4].y += offsetY
                    }

                }
                el.points = [rectPoints[0], rectPoints[2]]
            } else {

                for (let i = 0; i < el.points.length; i++) {
                    let point = el.points[i]
                    if (point == startingPointPosition) {
                        el.points[i].x = point.x + offsetX
                        el.points[i].y = point.y + offsetY 
                    }
                }
            }
            changeElement(el)
            setSelectedElement(null)
            setXCounter(0)
            setYCounter(0)
        } 
        // if element selected -> move from previous to new position
        // need previous pointer down point
        // apply offset to all points
        // later apply only to target point
        console.log("selectedEl: ",selectedElement)
        // should be action not moving!
        // setSelectedElement(null)
    }


  return (
  <>
    {showPopup && (
        <ScalePopup handleScaleInput={handleScaleInput} />
      )}   
    <Gridlines pixelsPerMesh={pixelsPerMesh} dimensions={dimensions} hasScale={hasScale}/>
    {/* fdrobot should be on top of everything else */}
    {/* {menuOverlay} */}
    {tool == 'scale' ? <FDRobot hintText={'Set scale: Draw two points where the distance between is known. Hold ctrl to activate ortho mode.'}/> : <>
    </>
    }
    
      <canvas 
      ref={canvasRef}
      width={canvasWidth} // pass in width and height as props
      height={canvasHeight}
      className={`border border-black rounded-md bg-transparent inset-0 absolute z-10 ${selectedElement ? 'select-none' : ''}`}
    //   className='border border-black rounded-md bg-transparent inset-0 absolute z-10'
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      />
  </>
  )
}

export default Canvas