import { splitIntoElevations, gridlineStations, pointToPolylineDistance, polylineLength, projectSpanOntoWall, baysCoveredBySpan, assessElevationBays, celsiusToKelvin } from './efsViewFactor'

export function endOptions(config = {}, scale = 1) {
    return {
        firstSpacing: config.firstEnabled && config.firstSpacing > 0 ? Number(config.firstSpacing) * scale : undefined,
        lastSpacing: config.lastEnabled && config.lastSpacing > 0 ? Number(config.lastSpacing) * scale : undefined,
    }
}

export function canvasBays(points, spacing, pixelsPerMetre, endSpacing = {}) {
    if (!(spacing > 0) || !(pixelsPerMetre > 0)) return []
    return splitIntoElevations(points).flatMap((face, elevation) => {
        const stations = gridlineStations(face.points, spacing * pixelsPerMetre, endOptions(endSpacing[elevation], pixelsPerMetre))
        return stations.slice(1).map((station, index) => {
            const a = stations[index].point
            const b = station.point
            return { elevation, bay: index + 1, a, b, length: Math.hypot(b.x - a.x, b.y - a.y) / pixelsPerMetre }
        })
    })
}

export function hitCanvasBay(bays, point, tolerance) {
    let best = null
    let distance = tolerance
    for (const bay of bays) {
        const d = pointToPolylineDistance(point, [bay.a, bay.b])
        if (d < distance) { best = bay; distance = d }
    }
    return best
}

export function assessCanvasElevation(state, index) {
    const wall = state.convertedPoints.find(el => el.comments === 'efsWall')
    const boundary = state.convertedPoints.find(el => el.comments === 'efsBoundary')
    const faces = splitIntoElevations(wall?.finalPoints || [])
    const face = faces[index]
    const height = Number(state.efsHeight)
    const spacing = Number(state.efsColumnSpacing)
    if (!face || !(height > 0) || !(spacing > 0)) return null
    const opts = endOptions(state.efsEndSpacingByElev[index])
    const regions = []
    for (const el of state.convertedPoints) {
        if (!['efsProtected', 'efsUnprotected'].includes(el.comments) || !el.finalPoints?.length) continue
        const mid = el.finalPoints.reduce((p, q) => ({ x: p.x + q.x / el.finalPoints.length, y: p.y + q.y / el.finalPoints.length }), { x: 0, y: 0 })
        const nearest = faces.reduce((best, candidate, i) => pointToPolylineDistance(mid, candidate.points) < pointToPolylineDistance(mid, faces[best].points) ? i : best, 0)
        if (nearest !== index) continue
        const span = projectSpanOntoWall(face.points, el.finalPoints)
        const cfg = state.efsRegionConfig[el.id] || {}
        regions.push({ id: el.id, kind: el.comments === 'efsProtected' ? 'protected' : 'unprotected', bays: baysCoveredBySpan(polylineLength(face.points), spacing, span.start, span.end, opts), base: cfg.base == null ? 0 : Math.max(0, Math.min(height, cfg.base)), top: cfg.top == null ? height : Math.max(0, Math.min(height, cfg.top)) })
    }
    return assessElevationBays({ wallPoints: face.points, boundaryPoints: boundary?.finalPoints || [], buildingPoints: wall.finalPoints, height, spacing, T: celsiusToKelvin(Number(state.efsFireTempC)), protectedBays: state.efsProtectedByElev[index] || [], regions, ...opts })
}
