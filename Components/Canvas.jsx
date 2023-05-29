import { useEffect, useRef, useState } from 'react'
import Gridlines from './Gridlines'

// eslint-disable-next-line react/prop-types
function Canvas({tool, dimensions}) {
    console.log(dimensions)
    const [currentPoly, setCurrentPoly] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    const canvasRef = useRef(null)
    const pixelsPerMesh = 10
    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height

    useEffect(() => {
        // TODO: needs to redraw all elements each frame
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
            setIsDrawing(true) // drawing set to false on press of enter

            // if not first vertex -> draw line from last index to vertex (on mousemove)
            // draw vertex
            let dimension = 10
            context.fillStyle = 'green'
            let newP = {x: event.pageX, y: event.pageY}
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