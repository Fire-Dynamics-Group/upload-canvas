// BR 187 external-fire-spread (EFS) view-factor primitive + boundary-distance
// goal-seek. Pure functions, no React/DOM — ported from the validated
// EFS_ViewFactor_GS.py / EFS.xlsx. See the "EFS View Factor Tool" design note.
//
// v1 emitter model is the WHOLE elevation (width x height) radiating at the fire
// temperature; openings-as-emitters arrive in a later slice.

export const SIGMA = 5.67e-11        // kW/m^2/K^4  (note: kW, not W)
export const EPSILON = 1.0
export const DEFAULT_TARGET_IS = 12.6 // kW/m^2 (BR 187 boundary criterion)
export const CELSIUS_TO_KELVIN = 273

export const celsiusToKelvin = (c) => c + CELSIUS_TO_KELVIN

// Black/grey-body emissive power E = epsilon * sigma * T^4  [kW/m^2].
export const emissivePower = (T, epsilon = EPSILON, sigma = SIGMA) =>
    epsilon * sigma * T ** 4

// Hottel corner-rectangle view factor: from a differential receiver to a
// rectangle of sides (a, b) whose corner sits on the receiver normal at
// distance S. Returns 0 for a degenerate rectangle or non-positive distance.
export function viewFactorRect(a, b, S) {
    if (S <= 0 || a <= 0 || b <= 0) return 0
    const X = a / S
    const Y = b / S
    const sx = Math.sqrt(1 + X * X)
    const sy = Math.sqrt(1 + Y * Y)
    return (1 / (2 * Math.PI)) * (
        (X / sx) * Math.atan(Y / sx) + (Y / sy) * Math.atan(X / sy)
    )
}

// Sum of the four corner rectangles (LB, RB, LT, RT) about a gridline that
// splits the elevation into left/right widths, with the receiver between
// bottom_h and top_h vertically.
export function totalViewFactor(leftW, rightW, S, bottomH, topH) {
    return (
        viewFactorRect(leftW, bottomH, S) +
        viewFactorRect(rightW, bottomH, S) +
        viewFactorRect(leftW, topH, S) +
        viewFactorRect(rightW, topH, S)
    )
}

// Incident radiation at the receiver: Is = E * F_total  [kW/m^2].
export function incidentRadiation(leftW, rightW, S, bottomH, topH, T) {
    return emissivePower(T) * totalViewFactor(leftW, rightW, S, bottomH, topH)
}

// Goal-seek the separation S at which incident radiation == targetIs. Flux is
// monotonically decreasing in S, so bisect. Returns sLo if the target is
// unreachable even at the closest distance (surface too small/cool).
export function solveSForTarget(
    leftW, rightW, bottomH, topH, T, targetIs = DEFAULT_TARGET_IS,
    { sLo = 1e-4, sHi = 5000, tol = 1e-6, maxIter = 500 } = {},
) {
    const f = (S) => incidentRadiation(leftW, rightW, S, bottomH, topH, T) - targetIs

    // Expand the upper bound if the target is still exceeded there.
    let hi = sHi
    while (f(hi) > 0 && hi < 1e7) hi *= 2

    // Unreachable: even at the closest distance the flux is below target.
    if (f(sLo) < 0) return sLo

    let lo = sLo
    for (let i = 0; i < maxIter && (hi - lo) > tol; i++) {
        const mid = (lo + hi) / 2
        if (f(mid) > 0) lo = mid
        else hi = mid
    }
    return (lo + hi) / 2
}

// Required distance to the notional boundary = half the facing-radiator
// separation (BR 187 mirror convention; EFS.xlsx col V = U/2). NOTE: this S/2
// convention is being reconfirmed for discrete openings (see decision issue).
export const requiredBoundaryDistance = (S) => S / 2

// Sweep gridlines across an elevation of `width` (step `spacing`, clamped to the
// far edge) and goal-seek the required boundary distance at each. Whole-elevation
// emitter. Returns per-gridline rows plus the governing (max) required distance.
export function solveElevation({ width, height, T, spacing, targetIs = DEFAULT_TARGET_IS }) {
    if (!(width > 0) || !(height > 0) || !(spacing > 0)) {
        throw new Error('solveElevation requires positive width, height and spacing')
    }
    const halfH = height / 2

    const xs = [0]
    while (xs[xs.length - 1] + spacing < width) xs.push(xs[xs.length - 1] + spacing)
    if (xs[xs.length - 1] < width) xs.push(width)

    const rows = xs.map((x, i) => {
        const leftW = x
        const rightW = width - x
        const S = solveSForTarget(leftW, rightW, halfH, halfH, T, targetIs)
        return {
            gridline: i + 1,
            leftW,
            rightW,
            S,
            requiredBoundaryDistance: requiredBoundaryDistance(S),
        }
    })

    const governingRequiredBoundaryDistance = rows.reduce(
        (m, r) => Math.max(m, r.requiredBoundaryDistance), 0,
    )

    return { rows, governingRequiredBoundaryDistance }
}

// --- geometry helpers (metre-space) for the actual boundary distance ----------

export function polylineLength(points) {
    let L = 0
    for (let i = 1; i < points.length; i++) {
        L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    }
    return L
}

// Point on a polyline at arc-length `dist` from its start (clamped to the ends).
export function pointAtDistanceAlong(points, dist) {
    if (dist <= 0) return { x: points[0].x, y: points[0].y }
    let acc = 0
    for (let i = 1; i < points.length; i++) {
        const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        if (acc + seg >= dist) {
            const t = seg === 0 ? 0 : (dist - acc) / seg
            return {
                x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
                y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
            }
        }
        acc += seg
    }
    const last = points[points.length - 1]
    return { x: last.x, y: last.y }
}

export function pointToSegmentDistance(p, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// Shortest distance from a point to a polyline (its closest part).
export function pointToPolylineDistance(p, points) {
    let min = Infinity
    for (let i = 1; i < points.length; i++) {
        min = Math.min(min, pointToSegmentDistance(p, points[i - 1], points[i]))
    }
    return min
}

export function closestPointOnSegment(p, a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return { x: a.x, y: a.y }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    return { x: a.x + t * dx, y: a.y + t * dy }
}

// Closest point (and its distance) on a polyline to p.
export function closestPointOnPolyline(p, points) {
    let best = { x: points[0].x, y: points[0].y }
    let bestD = Infinity
    for (let i = 1; i < points.length; i++) {
        const c = closestPointOnSegment(p, points[i - 1], points[i])
        const d = Math.hypot(p.x - c.x, p.y - c.y)
        if (d < bestD) { bestD = d; best = c }
    }
    return { point: best, distance: bestD }
}

// Unit direction of the wall segment that contains arc-length `dist`.
export function segmentDirAt(points, dist) {
    if (!points || points.length < 2) return null
    let acc = 0
    for (let i = 1; i < points.length; i++) {
        const ex = points[i].x - points[i - 1].x
        const ey = points[i].y - points[i - 1].y
        const seg = Math.hypot(ex, ey)
        if (acc + seg >= dist || i === points.length - 1) {
            const m = Math.hypot(ex, ey) || 1
            return { x: ex / m, y: ey / m }
        }
        acc += seg
    }
    return null
}

// Nearest intersection of the ray (origin O, unit dir D, t >= 0) with a polyline.
// Returns { point, distance } or null.
export function rayPolylineIntersection(O, D, points) {
    let best = null
    for (let i = 1; i < points.length; i++) {
        const A = points[i - 1]
        const B = points[i]
        const v1 = { x: O.x - A.x, y: O.y - A.y }
        const v2 = { x: B.x - A.x, y: B.y - A.y }
        const v3 = { x: -D.y, y: D.x }
        const denom = v2.x * v3.x + v2.y * v3.y
        if (Math.abs(denom) < 1e-12) continue // parallel
        const t = (v2.x * v1.y - v2.y * v1.x) / denom // cross(v2, v1) / denom
        const s = (v1.x * v3.x + v1.y * v3.y) / denom
        if (t >= 0 && s >= 0 && s <= 1) {
            if (!best || t < best.distance) {
                best = { point: { x: O.x + D.x * t, y: O.y + D.y * t }, distance: t }
            }
        }
    }
    return best
}

function ccw(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x)
}

// Proper crossing of segments p1p2 and p3p4 (touching at an endpoint — e.g. the
// measurement line starting on its own wall segment — does NOT count).
function segmentsCross(p1, p2, p3, p4) {
    const d1 = ccw(p3, p4, p1)
    const d2 = ccw(p3, p4, p2)
    const d3 = ccw(p1, p2, p3)
    const d4 = ccw(p1, p2, p4)
    return (
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    )
}

// True if the straight line P -> C does NOT pass through the building, i.e. it
// does not properly cross the wall polyline (the building outline).
export function lineOfSightClear(P, C, wallPoints) {
    for (let i = 1; i < wallPoints.length; i++) {
        if (segmentsCross(P, C, wallPoints[i - 1], wallPoints[i])) return false
    }
    return true
}

// Boundary distance measured PERPENDICULAR to the elevation at arc-length `dist`
// (per BR 187 practice — the boundary distance is taken normal to the facade, not
// as a shortest diagonal). Cast the two perpendiculars to the wall segment at the
// sample point, intersect each with the boundary polyline, and keep the nearest
// hit whose line is line-of-sight clear against the wall (so the outward normal
// wins and a normal that would cut back through the building is rejected). Falls
// back to the unconstrained nearest point (flagged `outward: false`) only if no
// perpendicular hits the boundary.
export function boundaryDistanceOutward(wallPoints, dist, boundaryPoints) {
    const from = pointAtDistanceAlong(wallPoints, dist)
    const dir = segmentDirAt(wallPoints, dist)

    if (dir) {
        const normals = [
            { x: -dir.y, y: dir.x },
            { x: dir.y, y: -dir.x },
        ]
        let best = null
        for (const n of normals) {
            const hit = rayPolylineIntersection(from, n, boundaryPoints)
            if (!hit) continue
            if (!lineOfSightClear(from, hit.point, wallPoints)) continue
            if (!best || hit.distance < best.distance) {
                best = { point: hit.point, distance: hit.distance }
            }
        }
        if (best) return { from, point: best.point, distance: best.distance, outward: true }
    }

    const c = closestPointOnPolyline(from, boundaryPoints)
    return { from, point: c.point, distance: c.distance, outward: false }
}

// Arc-length stations of the column gridlines along the wall: 0, spacing, ...,
// width (the far edge is always included). Returns [{ gridline, dist, point }].
export function gridlineStations(wallPoints, spacing) {
    if (!wallPoints || wallPoints.length < 2 || !(spacing > 0)) return []
    const width = polylineLength(wallPoints)
    const ds = [0]
    while (ds[ds.length - 1] + spacing < width) ds.push(ds[ds.length - 1] + spacing)
    if (ds[ds.length - 1] < width) ds.push(width)
    return ds.map((dist, i) => ({
        gridline: i + 1,
        dist,
        point: pointAtDistanceAlong(wallPoints, dist),
    }))
}

// Build one arrow per SEGMENT (bay between consecutive columns): sample the
// outward boundary distance every `sampleStep` along the segment and keep the
// WORST CASE = the smallest distance (closest approach), drawing the arrow at
// that worst point. Space-agnostic — pass pixel points + pixel spacing +
// pixel sampleStep for canvas drawing, or metre units throughout. Returns
// [{ segment, from, to, distance, outward }]; empty if inputs are insufficient.
export function buildBoundaryArrows(wallPoints, boundaryPoints, spacing, sampleStep) {
    if (!boundaryPoints || boundaryPoints.length < 2) return []
    const stations = gridlineStations(wallPoints, spacing)
    if (stations.length < 2) return []

    const arrows = []
    for (let i = 1; i < stations.length; i++) {
        const d0 = stations[i - 1].dist
        const d1 = stations[i].dist
        const span = d1 - d0
        const step = sampleStep > 0 ? sampleStep : span / 50
        let worst = null
        const consider = (d) => {
            const r = boundaryDistanceOutward(wallPoints, d, boundaryPoints)
            if (!worst || r.distance < worst.distance) worst = r
        }
        for (let d = d0; d < d1; d += step) consider(d)
        consider(d1) // always include the far column
        arrows.push({
            segment: i,
            from: worst.from,
            to: worst.point,
            distance: worst.distance,
            outward: worst.outward,
        })
    }
    return arrows
}

// Full assessment: sweep gridlines on the column grid, goal-seek the required
// boundary distance at each, and (if a boundary polyline is given) compare it to
// the actual boundary distance = the closest distance from that gridline point on
// the wall, outward to the boundary. Returns per-gridline rows + pass/fail.
export function assessElevation({
    wallPoints, boundaryPoints, height, T, spacing, targetIs = DEFAULT_TARGET_IS,
}) {
    if (!wallPoints || wallPoints.length < 2) {
        throw new Error('assessElevation requires a wall line of >= 2 points')
    }
    if (!(height > 0) || !(spacing > 0)) {
        throw new Error('assessElevation requires positive height and spacing')
    }
    const width = polylineLength(wallPoints)
    const halfH = height / 2
    const hasBoundary = Boolean(boundaryPoints && boundaryPoints.length >= 2)

    const ds = [0]
    while (ds[ds.length - 1] + spacing < width) ds.push(ds[ds.length - 1] + spacing)
    if (ds[ds.length - 1] < width) ds.push(width)

    const rows = ds.map((d, i) => {
        const leftW = d
        const rightW = width - d
        const S = solveSForTarget(leftW, rightW, halfH, halfH, T, targetIs)
        const viewFactorTotal = totalViewFactor(leftW, rightW, S, halfH, halfH)
        const incident = incidentRadiation(leftW, rightW, S, halfH, halfH, T)
        const required = requiredBoundaryDistance(S)
        const point = pointAtDistanceAlong(wallPoints, d)
        const actual = hasBoundary
            ? boundaryDistanceOutward(wallPoints, d, boundaryPoints).distance
            : null
        const pass = actual == null ? null : actual >= required
        return {
            gridline: i + 1,
            leftW,
            rightW,
            bottomH: halfH,
            topH: halfH,
            viewFactorTotal,
            incident,
            S,
            point,
            requiredBoundaryDistance: required,
            actualBoundaryDistance: actual,
            pass,
        }
    })

    const governingRequiredBoundaryDistance = rows.reduce(
        (m, r) => Math.max(m, r.requiredBoundaryDistance), 0,
    )
    const failingCount = rows.filter((r) => r.pass === false).length

    return {
        width,
        rows,
        governingRequiredBoundaryDistance,
        hasBoundary,
        failingCount,
        allPass: hasBoundary ? failingCount === 0 : null,
    }
}
