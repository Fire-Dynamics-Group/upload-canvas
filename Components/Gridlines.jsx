import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'

// TODO: send in 
// eslint-disable-next-line react/prop-types
function Gridlines({pixelsPerMesh, dimensions, hasScale, zoom = 1}) {
    let showGrid = true // later control via toggle
    const canvasRef = useRef(null)
    const currentMode = useStore((state) => state.currentMode)

    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, canvas.width, canvas.height)
        if (hasScale && showGrid && Number.isFinite(pixelsPerMesh) && pixelsPerMesh > 1) {
            let step = pixelsPerMesh
            const rawRows = Math.floor(canvas.height / step)
            const rawCols = Math.floor(canvas.width / step)
            if (step < 4 || rawRows > 400 || rawCols > 400) {
                const stride = Math.ceil(Math.max(rawRows, rawCols) / 400)
                step = pixelsPerMesh * stride
            }

            let rows = Math.floor(canvas.height / step)
            context.lineWidth = 0.2
            context.strokeStyle = 'rgba(0, 0, 0, 0.25)'
            for (let i = 0; i < rows; i++) {
                let path_text = 'M 0,' + `${(i + 1) * step}` + ' h ' + canvas.width + ' '
                let path = new Path2D(path_text)
                context.stroke(path)
            }
            let cols = Math.floor(canvas.width / step)
            for (let i = 0; i < cols; i++) {
                let path_text = `M ${(i + 1) * step}, 0, v ${canvas.height}`
                let path = new Path2D(path_text)
                context.stroke(path)
            }
        }
    }, [pixelsPerMesh, hasScale, currentMode, showGrid, dimensions])

    return (
        <>
            <canvas 
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}
                className='bg-transparent top-0 left-0 absolute z-[5] pointer-events-none'
            />
        </>
    )
}

export default Gridlines
