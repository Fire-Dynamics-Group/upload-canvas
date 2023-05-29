import { useEffect, useRef } from "react"
import useWindowSize from '../hooks/UseWindowsize'

export default function Canvas() {
    const canvasRef = useRef(null)
    const windowSize = useWindowSize()

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        context.fillStyle = 'blue'
        context.fillRect(0, 0, context.width, context.height)
    }, [])

    function handleClick(event) {
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        context.fillStyle = 'blue'
        context.fillRect(event.clientX - 50, event.clientY - 50, 100, 100)        
    }

    return (
    <>
        <canvas 
        ref={canvasRef}
        width={windowSize.width}
        height={windowSize.height}
        className='border border-black rounded-md bg-transparent inset-0 absolute z-10'
        onClick={handleClick}
        />
    </>
    )
    
}