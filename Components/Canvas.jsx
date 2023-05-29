import { useEffect, useRef, useState } from 'react'
import Gridlines from './Gridlines'

// eslint-disable-next-line react/prop-types
function Canvas({tool, dimensions}) {
    console.log(dimensions)
    const [currentPoly, setCurrentPoly] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    const canvasRef = useRef(null)
    const pixelsPerMesh = 10
    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height

    // TODO: event listener for ctrl button
    // lines to be ortho -> check if closer to x or y ortho
    useEffect(() => {
        console.log("useEffect")
        // later have on key up -> remove ortho control
        const handleCtrlPress = ({key}) => {
            console.log("keydown event: ",key)
            if (key == 'Control') {
              setIsCtrlPressed(true)
              console.log("true")
            }
        };
        window.addEventListener("keydown", handleCtrlPress)
        return () => {
            window.removeEventListener("keydown", handleCtrlPress)
        }
    }, [])
    useEffect(() => {
        // TODO: need to add finished polygon or points to object array
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, canvas.width, canvas.height)

        // later for each element
        // loop through polypoints
        for (let i=0; i<currentPoly.length; i++) {
            // draw vertex
            let dimension = 10
            context.fillStyle = 'green'
            context.fillRect(currentPoly[i].x - dimension/2, currentPoly[i].y - dimension/2, dimension, dimension)  

            // if i> 0 draw lines between points
            if (i == 0){
            context.beginPath()}
            if (i > 0) {
                let prev = currentPoly[i-1]
                let current = currentPoly[i]
                context.moveTo(prev.x, prev.y)
                context.lineTo(current.x, current.y)
                context.stroke()
            }

        }
    }, [currentPoly])

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
        // snap to grid using pixels per mesh
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
        }
    }
// TODO: move gridline canvas to own component
  return (
  <>
    <Gridlines pixelsPerMesh={pixelsPerMesh} dimensions={dimensions}/>
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