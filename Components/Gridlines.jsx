import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'

// TODO: send in 
// eslint-disable-next-line react/prop-types
function Gridlines({pixelsPerMesh, dimensions, hasScale, zoom = 1}) {
    const canvasRef = useRef(null)
    const currentMode = useStore((state) => state.currentMode)
    const efsShowScaleGrid = useStore((state) => state.efsShowScaleGrid)
    const showGrid = currentMode === 'efs' ? efsShowScaleGrid : true

    const canvasWidth = dimensions.width
    const canvasHeight = dimensions.height

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, canvas.width, canvas.height)
        if (hasScale && showGrid && Number.isFinite(pixelsPerMesh) && pixelsPerMesh > 1) {
            const step = pixelsPerMesh
            const rows = Math.floor(canvas.height / step)
            const cols = Math.floor(canvas.width / step)
            const pathParts = []
            for (let i = 0; i < rows; i++) {
                pathParts.push(`M 0,${(i + 1) * step} h ${canvas.width}`)
            }
            for (let i = 0; i < cols; i++) {
                pathParts.push(`M ${(i + 1) * step},0 v ${canvas.height}`)
            }
            if (pathParts.length > 0) {
                context.lineWidth = 0.2
                context.strokeStyle = 'rgba(0, 0, 0, 0.25)'
                context.stroke(new Path2D(pathParts.join(' ')))
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
