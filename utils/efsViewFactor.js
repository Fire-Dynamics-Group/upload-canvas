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
// hit whose line is line-of-sight clear against the building (so the outward
// normal wins and a normal that would cut back through the building is rejected).
// `losPoints` is the polyline used for the line-of-sight test — for a single face
// of a multi-elevation building pass the FULL outline so a face's normal can't
// measure through the rest of the building; defaults to the wall itself. Falls
// back to the unconstrained nearest point (flagged `outward: false`) only if no
// perpendicular hits the boundary.
export function boundaryDistanceOutward(wallPoints, dist, boundaryPoints, losPoints = wallPoints) {
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
            if (!lineOfSightClear(from, hit.point, losPoints)) continue
            if (!best || hit.distance < best.distance) {
                best = { point: hit.point, distance: hit.distance }
            }
        }
        if (best) return { from, point: best.point, distance: best.distance, outward: true }
    }

    const c = closestPointOnPolyline(from, boundaryPoints)
    return { from, point: c.point, distance: c.distance, outward: false }
}

// Outward perpendicular UNIT normal at arc-length `dist` along the wall — the
// direction in which the boundary distance is measured. Same selection rule as
// boundaryDistanceOutward (the perpendicular whose ray reaches the boundary
// line-of-sight clear, nearest hit wins); falls back to the direction of the
// nearest boundary point. Returns null if it cannot be determined. Used to lay
// the "needed boundary" locus out from the wall.
export function outwardNormalAt(wallPoints, dist, boundaryPoints, losPoints = wallPoints) {
    if (!boundaryPoints || boundaryPoints.length < 2) return null
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
            if (!lineOfSightClear(from, hit.point, losPoints)) continue
            if (!best || hit.distance < best.distance) best = { n, distance: hit.distance }
        }
        if (best) return best.n
    }
    const c = closestPointOnPolyline(from, boundaryPoints)
    const dx = c.point.x - from.x
    const dy = c.point.y - from.y
    const m = Math.hypot(dx, dy)
    return m > 0 ? { x: dx / m, y: dy / m } : null
}

// --- partial emitter (protected bays) -----------------------------------------
//
// Issue #8: when a column bay is made fire-rated ("protected") it is taken OUT of
// the emitter set. The emitter is then the union of the UNPROTECTED bays — a
// rectangle with holes. `totalViewFactor` above assumes a continuous emitter from
// the receiver out to both edges; `totalViewFactorPartial` generalises it to an
// arbitrary set of horizontal emitter intervals (bays), each `[a, b]` in
// width/arc-length space, for a receiver at horizontal position `xR`.

// View-factor contribution of one emitter strip [a, b] of height h to a receiver
// at xR, separation S. Mirrors the left/right corner-rectangle split used by
// `totalViewFactor`, generalised so the strip need not touch the receiver normal.
export function bayStrip(xR, a, b, h, S) {
    if (b <= xR) return viewFactorRect(xR - a, h, S) - viewFactorRect(xR - b, h, S)
    if (a >= xR) return viewFactorRect(b - xR, h, S) - viewFactorRect(a - xR, h, S)
    // straddling: the receiver normal falls inside the bay
    return viewFactorRect(xR - a, h, S) + viewFactorRect(b - xR, h, S)
}

// Total view factor from the receiver at xR to the holed emitter `bays`
// (array of [a, b]), summing the bottom and top corner rectangles (receiver at
// mid-height, so bottomH = topH = height/2). With a single bay [0, width] this
// reproduces totalViewFactor(xR, width - xR, ...) exactly (regression guard).
export function totalViewFactorPartial(xR, bays, S, bottomH, topH) {
    let f = 0
    for (const [a, b] of bays) {
        f += bayStrip(xR, a, b, bottomH, S) + bayStrip(xR, a, b, topH, S)
    }
    return f
}

// Goal-seek S for the partial (holed) emitter — same monotone bisection as
// solveSForTarget. With no emitter (all bays protected) the flux is zero and the
// required separation collapses to 0.
export function solveSForTargetPartial(
    xR, bays, bottomH, topH, T, targetIs = DEFAULT_TARGET_IS,
    { sLo = 1e-4, sHi = 5000, tol = 1e-4, maxIter = 300 } = {},
) {
    if (!bays.length) return 0
    const f = (S) => emissivePower(T) * totalViewFactorPartial(xR, bays, S, bottomH, topH) - targetIs
    let hi = sHi
    while (f(hi) > 0 && hi < 1e7) hi *= 2
    if (f(sLo) < 0) return sLo
    let lo = sLo
    for (let i = 0; i < maxIter && (hi - lo) > tol; i++) {
        const mid = (lo + hi) / 2
        if (f(mid) > 0) lo = mid
        else hi = mid
    }
    return (lo + hi) / 2
}

// Column gridline x-positions along an elevation of `width`: 0, spacing, ...,
// width (far edge always included). Bay i (1-indexed) spans [xs[i-1], xs[i]].
// `firstSpacing` / `lastSpacing` (opt) override the END bay widths — buildings
// often have non-typical end bays — so the first bay is `firstSpacing` wide
// and/or the last bay is `lastSpacing` wide, with the regular grid in between.
export function columnPositions(width, spacing, { firstSpacing, lastSpacing } = {}) {
    if (!(width > 0) || !(spacing > 0)) return [0]
    const xs = [0]
    const first = firstSpacing > 0 ? firstSpacing : spacing
    const lastStart = lastSpacing > 0 ? width - lastSpacing : null
    const limit = (lastStart != null && lastStart > 0) ? lastStart : width
    let x = first
    while (x < limit - 1e-9) { xs.push(x); x += spacing }
    if (lastStart != null && lastStart > xs[xs.length - 1] + 1e-9 && lastStart < width - 1e-9) {
        xs.push(lastStart)
    }
    if (xs[xs.length - 1] < width - 1e-9) xs.push(width)
    return xs
}

// Golden-section search for the maximum of a (locally unimodal) function on
// [lo, hi]. Used to refine the worst margin / required distance inside a bay.
function goldenSectionMax(f, lo, hi, iters = 40) {
    const gr = (Math.sqrt(5) - 1) / 2
    let a = lo, b = hi
    let c = b - gr * (b - a)
    let d = a + gr * (b - a)
    let fc = f(c), fd = f(d)
    for (let i = 0; i < iters; i++) {
        if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c) }
        else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d) }
    }
    const x = (a + b) / 2
    return { x, value: f(x) }
}

// Arc-length along a wall polyline of the point on it closest to p. Used to seed
// the critical-point set with the projections of boundary vertices (where the
// perpendicular boundary distance kinks).
export function arcLengthOfClosestPoint(points, p) {
    let acc = 0
    let best = { d: Infinity, s: 0 }
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]
        const b = points[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len2 = dx * dx + dy * dy
        let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const cx = a.x + t * dx
        const cy = a.y + t * dy
        const d = Math.hypot(p.x - cx, p.y - cy)
        const seg = Math.hypot(dx, dy)
        if (d < best.d) best = { d, s: acc + t * seg }
        acc += seg
    }
    return best.s
}

// --- banded emitter (protected / unprotected regions, issue #11) --------------
//
// Regions (#11) let the engineer mark spans of the elevation as PROTECTED
// (fire-rated -> removed from the emitter) or UNPROTECTED (a design constraint
// that must stay unprotected, e.g. required glazing). Each region snaps to whole
// column bays and carries a vertical band {base, top} (default 0..H, capped at
// H). Only PROTECTED bands change the radiation: the emitter becomes the whole
// face minus the protected bands (the complement of a part-height protected band
// still radiates). UNPROTECTED bands are non-numeric — they lock a bay (and that
// vertical zone) out of auto-suggest and forbid a protected band from overlapping
// them. To carry vertical bands the view factor needs 2-D telescoping.

// Signed extents of a 1-D interval [lo, hi] measured from the foot `p`, for the
// telescoping corner-rectangle sum. Two terms: straddling -> both positive;
// entirely to one side -> the near edge positive and the far edge subtracted.
function axisTerms(lo, hi, p) {
    if (hi <= p) return [{ e: p - lo, s: 1 }, { e: p - hi, s: -1 }]
    if (lo >= p) return [{ e: hi - p, s: 1 }, { e: lo - p, s: -1 }]
    return [{ e: p - lo, s: 1 }, { e: hi - p, s: 1 }]
}

// View factor from a receiver at (xR, m) to an emitter rectangle spanning
// [a, b] horizontally and [vb, vt] vertically (absolute heights), separation S.
// 2-D generalisation of bayStrip: telescopes independently on each axis, so the
// rectangle need not straddle the receiver. With a full-height band [0, H] and
// m = H/2 this reproduces the bottom_h = top_h = H/2 corner-rectangle sum.
export function rectVFAt(xR, a, b, vb, vt, m, S) {
    let f = 0
    for (const h of axisTerms(a, b, xR)) {
        for (const v of axisTerms(vb, vt, m)) {
            f += h.s * v.s * viewFactorRect(h.e, v.e, S)
        }
    }
    return f
}

// Total view factor from the receiver at xR to a list of emitter `pieces`, each
// { a, b, vb, vt }. Receiver at mid-height `m`.
export function totalViewFactorPieces(xR, pieces, S, m) {
    let f = 0
    for (const p of pieces) f += rectVFAt(xR, p.a, p.b, p.vb, p.vt, m, S)
    return f
}

// Goal-seek S for a banded (piecewise) emitter — same monotone bisection as the
// others; no emitter (everything protected) -> required collapses to 0.
export function solveSForTargetPieces(
    xR, pieces, m, T, targetIs = DEFAULT_TARGET_IS,
    { sLo = 1e-4, sHi = 5000, tol = 1e-4, maxIter = 300 } = {},
) {
    if (!pieces.length) return 0
    const f = (S) => emissivePower(T) * totalViewFactorPieces(xR, pieces, S, m) - targetIs
    let hi = sHi
    while (f(hi) > 0 && hi < 1e7) hi *= 2
    if (f(sLo) < 0) return sLo
    let lo = sLo
    for (let i = 0; i < maxIter && (hi - lo) > tol; i++) {
        const mid = (lo + hi) / 2
        if (f(mid) > 0) lo = mid
        else hi = mid
    }
    return (lo + hi) / 2
}

// Clamp a region's band to [0, height]; default to the full elevation height.
function normaliseBand(region, height) {
    let base = region.base == null ? 0 : region.base
    let top = region.top == null ? height : region.top
    base = Math.max(0, Math.min(height, base))
    top = Math.max(0, Math.min(height, top))
    if (!(top > base)) { base = 0; top = height }
    return { base, top }
}

const bandsOverlap = (a, b) => a.base < b.top - 1e-9 && b.base < a.top - 1e-9

// Subtract a set of bands from a set of emitting vertical intervals (interval
// difference). Used to remove protected bands from the full-height face.
function subtractBands(intervals, bands) {
    let out = intervals
    for (const band of bands) {
        const next = []
        for (const iv of out) {
            if (band.top <= iv.base + 1e-9 || band.base >= iv.top - 1e-9) { next.push(iv); continue }
            if (band.base > iv.base + 1e-9) next.push({ base: iv.base, top: band.base })
            if (band.top < iv.top - 1e-9) next.push({ base: band.top, top: iv.top })
        }
        out = next
    }
    return out
}

// The column bays a span [start, end] (arc-length along the wall) covers. Snaps
// to whole bays: any bay the span touches is included (so a region extends into
// the next bay if it crosses a column line). 1-indexed bay numbers.
export function baysCoveredBySpan(width, spacing, start, end, opts = {}) {
    const xs = columnPositions(width, spacing, opts)
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    const bays = []
    for (let i = 1; i < xs.length; i++) {
        if (hi > xs[i - 1] + 1e-9 && lo < xs[i] - 1e-9) bays.push(i)
    }
    return bays
}

// Project a drawn region polyline onto the wall: the arc-length span it covers,
// from the closest-point projections of its vertices.
export function projectSpanOntoWall(wallPoints, regionPoints) {
    const ls = regionPoints.map((p) => arcLengthOfClosestPoint(wallPoints, p))
    return { start: Math.min(...ls), end: Math.max(...ls) }
}

// Build the emitter (list of { a, b, vb, vt } pieces) for the elevation given the
// full-height protected bays (#8) and the banded regions (#11). Also returns
// per-bay status for labelling, the conflict bays (protected/unprotected bands
// overlapping vertically -> apply neither there), and the bays locked out of
// auto-suggest (those carrying an unprotected band).
export function buildEmitter({ width, spacing, height, protectedBays = [], regions = [], firstSpacing, lastSpacing }) {
    const xs = columnPositions(width, spacing, { firstSpacing, lastSpacing })
    const nBays = xs.length - 1
    const protectedSet = new Set(protectedBays)

    const protByBay = {}
    const unprotByBay = {}
    for (const r of regions) {
        const band = normaliseBand(r, height)
        for (const bay of (r.bays || [])) {
            const target = r.kind === 'protected' ? protByBay : unprotByBay
            ;(target[bay] = target[bay] || []).push(band)
        }
    }

    const pieces = []
    const bayStatus = []
    const conflictBays = []
    const lockedBays = []

    for (let i = 1; i <= nBays; i++) {
        const a = xs[i - 1]
        const b = xs[i]
        const protBands = protByBay[i] || []
        const unprotBands = unprotByBay[i] || []
        const conflict = protBands.some((p) => unprotBands.some((u) => bandsOverlap(p, u)))

        if (conflict) {
            conflictBays.push(i)
            // apply neither: bay reverts to the normal full-height emitter
            pieces.push({ a, b, vb: 0, vt: height })
            bayStatus.push({ bay: i, status: 'conflict', emitting: [{ base: 0, top: height }] })
            continue
        }

        if (unprotBands.length) lockedBays.push(i)

        let emitting = protectedSet.has(i) ? [] : [{ base: 0, top: height }]
        emitting = subtractBands(emitting, protBands)

        for (const iv of emitting) pieces.push({ a, b, vb: iv.base, vt: iv.top })

        let status = 'normal'
        if (emitting.length === 0) status = 'protected'
        else if (protBands.length && unprotBands.length) status = 'mixed'
        else if (protBands.length) status = 'partially-protected'
        else if (unprotBands.length) status = 'unprotected'
        bayStatus.push({ bay: i, status, emitting, protBands, unprotBands })
    }

    return { pieces, bayStatus, conflictBays, lockedBays, nBays, xs }
}

// Per-bay assessment with protected bays removed from the emitter. The unit is the
// column bay (segment between two columns); the popup table and the canvas arrows
// both work per-bay so they agree. For each bay the governing case is the WORST
// margin (required - actual) over the bay's wall span, found from the bay
// endpoints + boundary-vertex projections + a golden-section refinement (no
// blanket fixed-step sampling). Protected bays are compliant by construction.
export function assessElevationBays({
    wallPoints, boundaryPoints, height, T, spacing, protectedBays = [], regions = [],
    firstSpacing, lastSpacing, buildingPoints, targetIs = DEFAULT_TARGET_IS,
}) {
    if (!wallPoints || wallPoints.length < 2) {
        throw new Error('assessElevationBays requires a wall line of >= 2 points')
    }
    if (!(height > 0) || !(spacing > 0)) {
        throw new Error('assessElevationBays requires positive height and spacing')
    }
    // Full building outline for the line-of-sight test (so this face's normal
    // can't measure through the rest of the building); defaults to the face.
    const los = buildingPoints && buildingPoints.length >= 2 ? buildingPoints : wallPoints
    const width = polylineLength(wallPoints)
    const hh = height / 2
    const hasBoundary = Boolean(boundaryPoints && boundaryPoints.length >= 2)

    // Banded emitter: whole face minus protected bands (+ full-height protected
    // bays from #8). Unprotected bands are constraints/labels, not emitter
    // changes. With no regions this reduces to the unprotected-bays emitter.
    const { pieces, bayStatus, conflictBays, lockedBays, nBays, xs } = buildEmitter({
        width, spacing, height, protectedBays, regions, firstSpacing, lastSpacing,
    })
    const statusByBay = Object.fromEntries(bayStatus.map((s) => [s.bay, s]))

    const vertexProjections = hasBoundary
        ? boundaryPoints.map((v) => arcLengthOfClosestPoint(wallPoints, v))
        : []
    const actualAt = (xR) => (hasBoundary
        ? boundaryDistanceOutward(wallPoints, xR, boundaryPoints, los).distance
        : null)
    const requiredAt = (xR) => solveSForTargetPieces(xR, pieces, hh, T, targetIs) / 2

    const rows = []
    for (let i = 1; i <= nBays; i++) {
        const x0 = xs[i - 1]
        const x1 = xs[i]
        const st = statusByBay[i]
        const isProtected = st.status === 'protected' // fully removed from the emitter
        const marginAt = (xR) => {
            const required = requiredAt(xR)
            const actual = actualAt(xR)
            return actual == null ? required : required - actual
        }
        let worst = null
        const consider = (xR) => {
            if (xR < x0 || xR > x1) return
            const required = requiredAt(xR)
            const actual = actualAt(xR)
            const margin = actual == null ? required : required - actual
            if (!worst || margin > worst.margin) worst = { xR, required, actual, margin }
        }
        consider(x0)
        consider(x1)
        for (const p of vertexProjections) consider(p)
        // refine the interior worst point (required is unimodal; actual is
        // piecewise-linear, so the margin is smooth between vertex projections)
        consider(goldenSectionMax(hasBoundary ? marginAt : requiredAt, x0, x1).x)

        const required = worst.required
        const actual = worst.actual
        const S = required * 2
        const vf = totalViewFactorPieces(worst.xR, pieces, S, hh)
        const incident = emissivePower(T) * vf
        const out = hasBoundary ? boundaryDistanceOutward(wallPoints, worst.xR, boundaryPoints, los) : null
        rows.push({
            bay: i,
            leftCol: i,
            rightCol: i + 1,
            xWorst: worst.xR,
            leftW: worst.xR,
            rightW: width - worst.xR,
            bottomH: hh,
            topH: hh,
            viewFactorTotal: vf,
            incident,
            S,
            requiredBoundaryDistance: required,
            actualBoundaryDistance: actual,
            point: pointAtDistanceAlong(wallPoints, worst.xR),
            to: out ? out.point : null,
            protected: isProtected,
            status: st.status,
            emitting: st.emitting,
            pass: isProtected ? true : (actual == null ? null : actual >= required),
        })
    }

    const governingRequiredBoundaryDistance = rows.reduce(
        (m, r) => Math.max(m, r.requiredBoundaryDistance), 0,
    )
    const failingCount = rows.filter((r) => r.protected === false && r.pass === false).length

    return {
        width,
        nBays,
        rows,
        governingRequiredBoundaryDistance,
        hasBoundary,
        failingCount,
        allPass: hasBoundary ? failingCount === 0 : null,
        protectedBays: [...new Set(protectedBays)].sort((a, b) => a - b),
        conflictBays,
        lockedBays,
        hasConflict: conflictBays.length > 0,
        // Required boundary distance at each column station (S/2 with the current
        // emitter), for drawing the "needed boundary" locus on the canvas.
        requiredByStation: xs.map((x) => solveSForTargetPieces(x, pieces, hh, T, targetIs) / 2),
    }
}

// Auto-protect loop (issue #8): protect one bay at a time, recomputing after each
// step (protecting a bay lowers `required` for ALL positions, so the worst point
// moves), until every unprotected bay passes or no candidates remain. Ordering:
// worst-shortfall (required/actual ratio) descending; with `cornersFirst` the two
// end bays sort ahead. Returns the protected set, the ordered `steps`, whether
// compliance was achieved, and the final assessment.
export function suggestProtection({
    wallPoints, boundaryPoints, height, T, spacing, cornersFirst = true, regions = [],
    firstSpacing, lastSpacing, buildingPoints, targetIs = DEFAULT_TARGET_IS,
}) {
    const run = (protectedBays) => assessElevationBays({
        wallPoints, boundaryPoints, height, T, spacing, protectedBays, regions,
        firstSpacing, lastSpacing, buildingPoints, targetIs,
    })
    let assessment = run([])
    if (!assessment.hasBoundary) {
        return { protectedBays: [], steps: [], achievable: false, reason: 'no-boundary', assessment }
    }
    const nBays = assessment.nBays
    // Bays carrying an unprotected (must-stay-open) band, or in a conflict, can't
    // be auto-protected (#11): protecting the whole bay would remove the must-emit
    // band. The engineer handles their complement manually.
    const locked = new Set([...(assessment.lockedBays || []), ...(assessment.conflictBays || [])])
    const protectedSet = new Set()
    const steps = []
    const ratio = (r) => (r.actualBoundaryDistance > 0
        ? r.requiredBoundaryDistance / r.actualBoundaryDistance
        : Infinity)

    let guard = 0
    while (assessment.failingCount > 0 && guard++ <= nBays) {
        const cands = assessment.rows.filter((r) => r.protected === false && !locked.has(r.bay))
        if (!cands.length) {
            return { protectedBays: [...protectedSet].sort((a, b) => a - b), steps, achievable: false, reason: 'exhausted', assessment }
        }
        cands.sort((a, b) => {
            if (cornersFirst) {
                const aCorner = (a.bay === 1 || a.bay === nBays) ? 1 : 0
                const bCorner = (b.bay === 1 || b.bay === nBays) ? 1 : 0
                if (aCorner !== bCorner) return bCorner - aCorner
            }
            return ratio(b) - ratio(a)
        })
        const pick = cands[0].bay
        protectedSet.add(pick)
        steps.push(pick)
        assessment = run([...protectedSet])
    }

    const achievable = assessment.failingCount === 0
    return {
        protectedBays: [...protectedSet].sort((a, b) => a - b),
        steps,
        achievable,
        reason: achievable ? 'compliant' : 'not-achievable',
        assessment,
    }
}

// Decompose a drawn building outline into its ELEVATIONS (faces), issue #10. The
// engineer draws one polyline around the whole building; this walks it and starts
// a new elevation at every "real" corner — a vertex whose turn angle exceeds
// `angleThresholdDeg` — merging near-collinear runs (small jogs/setbacks) into one
// face. A closed outline (first point repeated) is treated cyclically. Returns
// [{ index, points }] with each face's own polyline; one element (the whole line)
// if there are no sharp corners. Each face is then assessed independently against
// the shared boundary, with the full outline used for line-of-sight.
export function splitIntoElevations(points, angleThresholdDeg = 20) {
    if (!points || points.length < 2) return []
    const eq = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
    const closed = points.length > 3 && eq(points[0], points[points.length - 1])
    const verts = closed ? points.slice(0, -1) : points.slice()
    const n = verts.length
    if (n < 2) return []
    if (n === 2) return [{ index: 1, points: [verts[0], verts[1]] }]

    const seg = (i) => {
        const a = verts[i]
        const b = verts[(i + 1) % n]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const m = Math.hypot(dx, dy) || 1
        return { x: dx / m, y: dy / m }
    }
    const turnDeg = (i) => {
        const d0 = seg((i - 1 + n) % n)
        const d1 = seg(i % n)
        const dot = Math.max(-1, Math.min(1, d0.x * d1.x + d0.y * d1.y))
        return Math.acos(dot) * 180 / Math.PI
    }

    const corners = []
    if (closed) {
        for (let i = 0; i < n; i++) if (turnDeg(i) > angleThresholdDeg) corners.push(i)
    } else {
        corners.push(0)
        for (let i = 1; i < n - 1; i++) if (turnDeg(i) > angleThresholdDeg) corners.push(i)
        corners.push(n - 1)
    }

    const elevations = []
    if (closed) {
        if (corners.length < 2) return [{ index: 1, points: [...verts, verts[0]] }]
        for (let c = 0; c < corners.length; c++) {
            const startI = corners[c]
            const endI = corners[(c + 1) % corners.length]
            const facePts = [verts[startI]]
            let i = startI
            while (i !== endI) { i = (i + 1) % n; facePts.push(verts[i]) }
            elevations.push({ index: elevations.length + 1, points: facePts })
        }
    } else {
        for (let c = 0; c < corners.length - 1; c++) {
            const facePts = []
            for (let i = corners[c]; i <= corners[c + 1]; i++) facePts.push(verts[i])
            elevations.push({ index: elevations.length + 1, points: facePts })
        }
    }
    return elevations
}

// BRE 135 (enclosing-rectangle) elevations derived from the drawn outline. Reuses
// splitIntoElevations so an "elevation" means the same thing as in the BR 187
// view-factor method (one per face). Each face carries its width and the
// worst-case (smallest) perpendicular boundary distance along it (line-of-sight
// against the full outline so it can't measure through the building);
// boundaryDistance is null when no boundary is drawn. This seeds the BRE 135 tab
// (the engineer can override the per-elevation boundary distance).
export function bre135ElevationsFromWall(wallPoints, boundaryPoints, sampleStep = 0.5) {
    if (!wallPoints || wallPoints.length < 2) return []
    const hasBoundary = Boolean(boundaryPoints && boundaryPoints.length >= 2)
    const faces = splitIntoElevations(wallPoints)
    return faces.map((face, i) => {
        const width = polylineLength(face.points)
        let boundaryDistance = null
        if (hasBoundary && width > 0) {
            const step = sampleStep > 0 ? sampleStep : width / 50
            let min = Infinity
            const consider = (d) => {
                const r = boundaryDistanceOutward(face.points, d, boundaryPoints, wallPoints)
                if (r && Number.isFinite(r.distance)) min = Math.min(min, r.distance)
            }
            for (let d = 0; d < width; d += step) consider(d)
            consider(width) // always include the far corner
            boundaryDistance = Number.isFinite(min) ? min : null
        }
        return {
            elevationNumber: i + 1,
            index: face.index,
            width,
            boundaryDistance,
        }
    })
}

// Arc-length stations of the column gridlines along the wall: 0, spacing, ...,
// width (the far edge is always included). Returns [{ gridline, dist, point }].
export function gridlineStations(wallPoints, spacing, opts = {}) {
    if (!wallPoints || wallPoints.length < 2 || !(spacing > 0)) return []
    const width = polylineLength(wallPoints)
    return columnPositions(width, spacing, opts).map((dist, i) => ({
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
export function buildBoundaryArrows(wallPoints, boundaryPoints, spacing, sampleStep, losPoints = wallPoints, opts = {}) {
    if (!boundaryPoints || boundaryPoints.length < 2) return []
    const stations = gridlineStations(wallPoints, spacing, opts)
    if (stations.length < 2) return []

    const arrows = []
    for (let i = 1; i < stations.length; i++) {
        const d0 = stations[i - 1].dist
        const d1 = stations[i].dist
        const span = d1 - d0
        const step = sampleStep > 0 ? sampleStep : span / 50
        let worst = null
        const consider = (d) => {
            const r = boundaryDistanceOutward(wallPoints, d, boundaryPoints, losPoints)
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

// The "needed boundary" locus: offset each gridline station outward (toward the
// boundary, perpendicular) by its required distance. The actual boundary must lie
// BEYOND this line everywhere to comply, so drawing it lets the engineer see how
// far the boundary needs to be. `requiredByStation[i]` is the required distance
// for station i in the SAME space/units as `wallPoints` (pass metre values with
// metre points, or pixel values with pixel points). Space-agnostic, mirroring
// buildBoundaryArrows. Returns [{ gridline, from, required, point }]; `point` is
// null where the outward direction can't be found. [] without a boundary.
export function buildRequiredBoundaryLine(wallPoints, boundaryPoints, spacing, requiredByStation, losPoints = wallPoints, opts = {}) {
    if (!boundaryPoints || boundaryPoints.length < 2) return []
    const stations = gridlineStations(wallPoints, spacing, opts)
    if (stations.length < 2 || !requiredByStation || !requiredByStation.length) return []
    return stations.map((st, i) => {
        const required = requiredByStation[i]
        const n = (required == null) ? null : outwardNormalAt(wallPoints, st.dist, boundaryPoints, losPoints)
        return {
            gridline: st.gridline,
            from: st.point,
            required,
            point: n ? { x: st.point.x + n.x * required, y: st.point.y + n.y * required } : null,
        }
    })
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
