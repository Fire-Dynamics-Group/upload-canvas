// Pure helper for Time Equivalence mode canvas labels.
//
// Returns the label text + anchor (midpoint) for each wall and opening so the
// canvas can render "Wall N" / "Opening N" markers that line up with the
// Wall N / Opening N inputs in the Time Equivalence popup. Presentation
// (font, colour, pixel offsets) stays in the render loop.

export function computeTimeEqLabels(elements = []) {
    const walls = []

    // Walls: segments of the FIRST obstruction polygon. The popup derives its
    // wall inputs from obstructions[0].finalPoints.length - 1, so we use the
    // same single obstruction and the same segment count to stay in step.
    const obstruction = elements.find((el) => el.comments === 'obstruction')
    if (obstruction && obstruction.points && obstruction.points.length >= 2) {
        const pts = obstruction.points
        for (let i = 0; i < pts.length - 1; i++) {
            walls.push({
                text: `Wall ${i + 1}`,
                x: (pts[i].x + pts[i + 1].x) / 2,
                y: (pts[i].y + pts[i + 1].y) / 2,
            })
        }
    }

    // Openings: one label per opening element, in array order — matching the
    // popup, which lists openings via elements.filter(comments === 'opening').
    const openings = []
    elements
        .filter((el) => el.comments === 'opening')
        .forEach((el, i) => {
            const pts = el.points
            if (pts && pts.length >= 1) {
                const a = pts[0]
                const b = pts[pts.length - 1]
                openings.push({
                    text: `Opening ${i + 1}`,
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2,
                })
            }
        })

    return { walls, openings }
}
