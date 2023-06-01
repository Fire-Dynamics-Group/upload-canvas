import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Gridlines from './Gridlines'
import ScalePopup from './ScalePopup'
import FDRobot from './FDRobot'

// eslint-disable-next-line react/prop-types
function Canvas({tool, setTool, dimensions, isDevMode}) {
    console.log(tool)
    // TODO: have currentElement array with {} including type etc like elements
    const [currentPoly, setCurrentPoly] = useState([])
    const [currentRect, setCurrentRect] = useState([])

    const [elements, setElements] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    
    // TODO: have a keyPressed useState -> with which key
    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    // on enter -> isDrawing = false
    // add polyline to state
    // add type of line -> include in useLayoutEffect canvas rendering
    const [isEnterPressed, setIsEnterPressed] = useState(false)
    const canvasRef = useRef(null)
    // const pixelsPerMesh = 10 // calc from scale
    const [pixelsPerMesh, setPixelsPerMesh] = useState(1)
    const [hasScale, setHasScale] = useState(false)
    const [scalePoints, setScalePoints] = useState([])
    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height
    // TODO: if drawing have line between penultimate point and cursor
    // have state that is true when drawing is true and mouse moving -> store mouse
    const [guideLine, setGuideLine] = useState(null)

    // below logic for popup
    const [showPopup, setShowPopup] = useState(false)
    const [scaleDistance, setScaleDistance] = useState(null)

    console.log("scaleDistance: ", scaleDistance)      

    function returnElementObject(type, pointsArray, comments) {
        return {
            "type": type,
            "points": pointsArray,
            "comments": comments
        }        
    }
    // event listener for ctrl button
    // lines to be ortho -> check if closer to x or y ortho
    // LATER: move keypress to own component -> send back keys pressed or keyup
    useEffect(() => {
        const handleKeyPress = ({key}) => {
            if (key == 'Control') {
                setIsCtrlPressed(true)
            }
            // "Enter"
            if (key == 'Enter') {
                console.log("keydown event: ",key, elements)
                // why is this only being hit sometimes??
                function addElementToState() {
                    let type = "polyline"
                    let comments = "Common Corridor Obstructions"
                    if (tool == 'polyline') {
                        if (currentPoly.length > 0 ) {
                            let current_el = {
                                "type": type,
                                "points": currentPoly,
                                "comments": comments
                            }
                            console.log("current_el: ", current_el
                            )

                            setElements(prev => [...prev, current_el])
                            setIsDrawing(false)
                            setCurrentPoly([])
                            if (isDevMode) {
                                setTool("rect")
                            }
                        }
                    }
                }

                // action adding polyline to state if applicable
                // clear current poly
                addElementToState()
                setIsEnterPressed(true)
                
              }
        };
        const handleCtrlRelease = ({key}) => {
            console.log("keyup event: ",key)
            if (key == 'Control') {
                setIsCtrlPressed(false)
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
    }, [elements, currentPoly, tool, setTool, isDevMode])

    // LATER: move to own component -> sends back null or position object
    useEffect(() => {
        // TODO: guide rect for meshes
        const handleMouseMove = (event) => {
            // currentElement should have type and can include scale
            if (isDrawing && currentPoly.length > 0 || tool === 'scale' && scalePoints.length == 1 || tool === 'rect' && currentRect.length == 1) { // and tool == polyline
                setGuideLine({x: event.pageX, y: event.pageY})
            } else {
                setGuideLine(null)
            }
        };

        window.addEventListener("mousemove", handleMouseMove)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
        }
    }, [isDrawing, currentPoly, scalePoints.length, tool])

    function distance(p1, p2) {
        let a = p1.x - p2.x
        let b = p1.y - p2.y
        return Math.sqrt( a*a + b*b );
    }

    function deltaGridlines(pxPerMesh, tool) { // actioned if debug mode and after scale set normally
        setPixelsPerMesh(pxPerMesh)
        setHasScale(true)
        setShowPopup(false)
        // change from scale mode to drawing mode
        setTool(tool)
    }

    function handleScaleInput(inputDistance) {
        let scaleDistance = inputDistance
        let desiredScale = 0.1 //m - later be changeable
        let pixels = distance(scalePoints[0], scalePoints[1])
        let temp = pixels / (scaleDistance / desiredScale)
        deltaGridlines(temp, 'polyline')
    }
    // useEffect(() => {
    //     // calc distance of scale line drawn

    // }, [scaleDistance, scalePoints])
    // drawing loop below
    useLayoutEffect(() => {
        // TODO: need to add finished polygon or points to object array
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        context.clearRect(0, 0, canvas.width, canvas.height)

        function drawRect(points, context) {
            // same for guide 
            // LATER: just without green point at second point
            // corners below line so line is visible
            // for (let i=0; i<points.length; i++) {
            //     // draw vertex
            //     let dimension = 10
            //     context.fillStyle = 'green'
            //     context.fillRect(points[i].x - dimension/2, points[i].y - dimension/2, dimension, dimension)
            // }
            // always 2 points
            // draw rect
                // ctx.strokeRect(50, 50, 200, 100); // x, y, width, height
            console.log("points: ", points)
            let p1 = points[0]
            let p2 = points[1]
            let deltaX = p2.x - p1.x
            let deltaY = p2.y - p1.y
            context.strokeStyle = 'blue'
            // context.lineWidth = 2;
            context.strokeRect(p1.x, p1.y, deltaX, deltaY)

        }

        function drawPolyline(points, context) {
            for (let i=0; i<points.length; i++) {
                // draw vertex
                let dimension = 10
                context.fillStyle = 'green'
                context.fillRect(points[i].x - dimension/2, points[i].y - dimension/2, dimension, dimension)  
    
                // if i> 0 draw lines between points
                if (i == 0){
                context.beginPath()}
                if (i > 0) {
                    let prev = points[i-1]
                    let current = points[i]
                    context.strokeStyle = 'black'
                    context.moveTo(prev.x, prev.y)
                    context.lineTo(current.x, current.y)
                    context.stroke()
                }
    
            }            
        }
        // loop through current polypoints
        if (isDrawing) {
                // should be current element with type and points object
                function drawPolyAndGuide(poly) {

                    drawPolyline(poly, context)
                    console.log("guidline: ", guideLine)
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
                console.log("hits here")
                if (tool === 'polyline') {
                    drawPolyAndGuide(currentPoly)
                } else if (tool === 'scale') {
                    drawPolyAndGuide(scalePoints)
                } else if (tool == 'rect') {
                    console.log("rect drawing: ", currentRect)
                    if (currentRect.length == 1) {
                        // use guide for mousePosition
                        if (guideLine != null) {

                            // have guide point for rect -> send to draw rect
                            let rectPoints = [currentRect[0], guideLine]
                            drawRect(rectPoints, context)
                        }
                    }
                }

        }

        // all historical elements
        // later have different logic for different line types
        elements.forEach(element => {
            console.log("element: ", element)
            if (element.type == 'polyline' || element.type == 'scale') {

                drawPolyline(element.points, context)
            } else if (element.type == 'rect') {
                drawRect(element.points, context)
            }
        })

    }, [currentPoly, guideLine, isCtrlPressed, isDrawing, elements, scalePoints, tool, currentRect])

    function snapVertexOrtho(vertex, prevVertex) {
        // check if diff is greater in x or y between vertices
        console.log("vertices: ", vertex, prevVertex)
        const deltaX = Math.abs(prevVertex.x - vertex.x)
        const deltaY = Math.abs(prevVertex.y - vertex.y)

        // snap to the same of least difference
        if (deltaX < deltaY) {
            vertex.x = prevVertex.x
        } else {
            vertex.y = prevVertex.y
        }
        return vertex

    }
    function snapVertexToGrid(vertex) {
        // snap to grid using pixels per mesh -> use 1
        vertex.x = (Math.round(vertex.x / pixelsPerMesh)) * pixelsPerMesh
        vertex.y = (Math.round(vertex.y / pixelsPerMesh)) * pixelsPerMesh

        return vertex
    }
    //   TODO: polyline and mark point tools
    function handleClick(event) {
        console.log(currentPoly)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (tool === 'point') {
            context.fillStyle = 'blue'

            let dimension = 5

            let newP = {x: event.pageX, y: event.pageY}
            newP = snapVertexToGrid(newP)
            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        }
        else if (tool === 'polyline') {
            setIsDrawing(true) // drawing set to false on press of enter or return to origin

            // if not first vertex -> draw line from last index to vertex (on mousemove)
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
                console.log("currentRect: ", currentRect)
            // on second point
            // newP = snapVertexOrtho(newP, currentRect[0])
                // snap to grid
                newP = snapVertexToGrid(newP)
                let pointsArray = [currentRect[0], newP]
                let comments = "mesh"
                // add to elements state
                let currentEl = returnElementObject(tool, pointsArray, comments)
                setElements(prev => [...prev, currentEl])
                // set current rect to []
                setCurrentRect([])
                setIsDrawing(false)
            }

            context.fillRect(newP.x - dimension/2, newP.y - dimension/2, dimension, dimension)        
        }
        else if (tool === 'scale') {
            if (scalePoints.length < 2) {
                // if (scalePoints.length == 1) {
                    
                // }
                let prevIndex = scalePoints.length
                setIsDrawing(true) // drawing set to false on press of enter or return to origin
    
                // if not first vertex -> draw line from last index to vertex (on mousemove)
                // only allow two dots and then enter length
                // draw vertex
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
                console.log("prevIndex: ", prevIndex)
                // hopefully second point has registered
                if (prevIndex == 1) {
                    // action pop up
                    setShowPopup(true)
                }

            }
            // else allow to restart scale process
        }
    }
    // if (isDevMode) {
    //     let pxPerMesh = 10
    //     let tool = 'polyline'
    //     deltaGridlines(pxPerMesh, tool)
    // }
  return (
  <>
    {showPopup && (
        <ScalePopup handleScaleInput={handleScaleInput} />
      )}   
    <Gridlines pixelsPerMesh={pixelsPerMesh} dimensions={dimensions} hasScale={hasScale}/>
    {/* fdrobot should be on top of everything else */}
    {tool == 'scale' ? <FDRobot hintText={'Set scale: Draw two points where the distance between is known. Hold ctrl to activate ortho mode.'}/> : null}
      <canvas 
      ref={canvasRef}
      width={canvasWidth} // pass in width and height as props
      height={canvasHeight}
      className='border border-black rounded-md bg-transparent inset-0 absolute z-10'
      onClick={handleClick}
      />
  </>
  )
}

export default Canvas