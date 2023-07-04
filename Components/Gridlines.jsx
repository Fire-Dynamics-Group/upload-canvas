import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'

// TODO: send in 
// eslint-disable-next-line react/prop-types
function Gridlines({pixelsPerMesh, dimensions, hasScale}) {
    let showGrid = true // later control via toggle
    console.log(dimensions, "grid")
    const canvasRef = useRef(null)
    const currentMode = useStore((state) => state.currentMode)

    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height

    useEffect(() => {
        console.log("gridlines check: ", hasScale, currentMode, pixelsPerMesh, dimensions)
        // TODO: needs to redraw all elements each frame
        // TODO: need to add finished polygon or points to object array
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, canvas.width, canvas.height)
        // FUTURE: recalc gridlines depending on viewport
        // allow zoom and pan of pdf floor plan
        // all gridlines
        if (hasScale && showGrid) {

            let rows = Math.floor(canvas.height / pixelsPerMesh)
    
            context.lineWidth = 0.2
            for (let i=0; i<rows; i++) {
                // later make 1 long svg -> may have issue removing particular points
                let path_text = 'M 0,' + `${(i+1)*pixelsPerMesh}` + ' h ' + canvas.width + ' '
                let path = new Path2D(path_text);
                context.stroke(path);
    
            }
            let cols = Math.floor(canvas.width / pixelsPerMesh)
    
            context.lineWidth = 0.2
            for (let i=0; i<cols; i++) {
                // later make 1 long svg -> may have issue removing particular points
                let path_text = `M ${(i+1)*pixelsPerMesh}, 0, v ${canvas.width}`
                let path = new Path2D(path_text);
                context.stroke(path);
    
            }
        }
    }, [pixelsPerMesh, hasScale, currentMode, showGrid, dimensions])

// should be width and height of image
  return (
  <>
      <canvas 
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className='border border-black rounded-md bg-transparent inset-0 absolute z-5'
      />
  </>
  )
}

export default Gridlines