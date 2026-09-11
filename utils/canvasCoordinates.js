// Keep stored geometry in PDF pixels, independent of display zoom and scrolling.
export function canvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect()
    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height,
    }
}

export function canvasClientPoint(point, canvas) {
    if (!canvas) return point
    const rect = canvas.getBoundingClientRect()
    return {
        x: rect.left + point.x * rect.width / canvas.width,
        y: rect.top + point.y * rect.height / canvas.height,
    }
}
