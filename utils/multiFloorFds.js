// Multi-floor state management, cross-floor coordinate alignment, and
// multi-floor FDS model assembly.

/** Integer element_index for POST /projects/{id}/save (backend ElementIn). */
export function toElementIndex(el, fallback = 0) {
    const candidates = [el?.element_index, el?.id, fallback]
    for (const c of candidates) {
        if (c === null || c === undefined || c === '') continue
        const n = Number(c)
        if (Number.isInteger(n)) return n
    }
    const fb = Number(fallback)
    return Number.isInteger(fb) ? fb : 0
}

export const DEFAULT_FLOOR_SETTINGS = {
    z_level: 0,
    wall_height: 3,
    doorRoles: {},
    doorLeakagesEnabled: true,
    doorLeakageConfig: {},
    landingRoles: {},
    landingUpSide: null,
    stairStyle: 'individual',
    extractConfig: {},
    inletConfig: {},
    zoneConfig: {},
    sliceZHeight: 2.0,
}

/**
 * Build a normalized floor object from partial data.
 */
export function normalizeFloor(raw = {}, index = 0, fallbackState = {}) {
    const floorNumber = raw.floor_number ?? index
    const rawSettings = raw.settings || {}
    const zLevel = Number(
        raw.z_level ?? rawSettings.z_level ?? (index === 0 ? fallbackState.fireFloorZ ?? 0 : index * (Number(fallbackState.wallHeight) || 3))
    )
    const wallHeight = Number(
        raw.wall_height ?? rawSettings.wall_height ?? fallbackState.wallHeight ?? 3
    )
    const defaultName = floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`

    const rawElements = raw.elements || []
    const normalizedElements = rawElements.map((el, i) => ({
        id: toElementIndex(el, i),
        type: el.type,
        points: el.points,
        comments: el.comments,
        ...(el.zoneName ? { zoneName: el.zoneName } : {}),
        ...(el.fsaDistance != null ? { fsaDistance: el.fsaDistance } : {}),
    }))

    return {
        id: raw.id ?? null,
        floor_number: floorNumber,
        name: raw.name || defaultName,
        z_level: Number.isFinite(zLevel) ? zLevel : 0,
        wall_height: Number.isFinite(wallHeight) && wallHeight > 0 ? wallHeight : 3,
        canvas_dimensions: raw.canvas_dimensions || {},
        pixels_per_mesh: raw.pixels_per_mesh || fallbackState.pixelsPerMesh || 1,
        origin_pixels: raw.origin_pixels ?? null,
        pdf_s3_key: raw.pdf_s3_key ?? null,
        hasCustomPdf: raw.hasCustomPdf ?? Boolean(raw.pdf_s3_key),
        pdfSource: raw.pdfSource ?? (raw.pdf_s3_key ? 'custom' : null),
        elements: normalizedElements,
        elementsHistory: raw.elementsHistory || [],
        elementsFuture: raw.elementsFuture || [],
        settings: {
            ...DEFAULT_FLOOR_SETTINGS,
            ...rawSettings,
            z_level: Number.isFinite(zLevel) ? zLevel : 0,
            wall_height: Number.isFinite(wallHeight) && wallHeight > 0 ? wallHeight : 3,
            doorRoles: rawSettings.doorRoles ?? {},
            doorLeakagesEnabled: rawSettings.doorLeakagesEnabled ?? true,
            doorLeakageConfig: rawSettings.doorLeakageConfig ?? {},
            landingRoles: rawSettings.landingRoles ?? {},
            landingUpSide: rawSettings.landingUpSide ?? null,
            stairStyle: rawSettings.stairStyle ?? 'individual',
            extractConfig: rawSettings.extractConfig ?? {},
            inletConfig: rawSettings.inletConfig ?? {},
            zoneConfig: rawSettings.zoneConfig ?? {},
            sliceZHeight: rawSettings.sliceZHeight ?? 2.0,
        },
    }
}

/**
 * Return the `floors` array with the active floor synced from the live top-level
 * store properties (`elements`, `pixelsPerMesh`, `originPixels`, `doorRoles`, etc.).
 * If `state.floors` is empty, synthesizes Floor 0 from the top-level fields.
 */
export function getSyncedFloors(state) {
    const existing = Array.isArray(state.floors) && state.floors.length > 0
        ? state.floors
        : [
            normalizeFloor(
                {
                    id: state.floorId ?? null,
                    floor_number: 0,
                    name: 'Fire Floor',
                    z_level: Number(state.fireFloorZ) || 0,
                    wall_height: Number(state.wallHeight) || 3,
                },
                0,
                state
            ),
        ]

    const activeIdx = Math.min(
        Math.max(0, state.activeFloorIndex ?? 0),
        existing.length - 1
    )

    return existing.map((floor, idx) => {
        if (idx !== activeIdx) return floor
        const zLevel = Number(state.fireFloorZ ?? floor.z_level ?? floor.settings?.z_level ?? 0)
        const wallHeight = Number(state.wallHeight ?? floor.wall_height ?? floor.settings?.wall_height ?? 3)
        return {
            ...floor,
            id: state.floorId ?? floor.id ?? null,
            z_level: Number.isFinite(zLevel) ? zLevel : 0,
            wall_height: Number.isFinite(wallHeight) && wallHeight > 0 ? wallHeight : 3,
            canvas_dimensions: state.canvasDimensions || floor.canvas_dimensions || {},
            pixels_per_mesh: state.pixelsPerMesh || floor.pixels_per_mesh || 1,
            origin_pixels: state.originPixels !== undefined ? state.originPixels : (floor.origin_pixels ?? null),
            elements: state.elements || [],
            elementsHistory: state.elementsHistory || [],
            elementsFuture: state.elementsFuture || [],
            settings: {
                ...(floor.settings || {}),
                z_level: Number.isFinite(zLevel) ? zLevel : 0,
                wall_height: Number.isFinite(wallHeight) && wallHeight > 0 ? wallHeight : 3,
                doorRoles: state.doorRoles ?? {},
                doorLeakagesEnabled: state.doorLeakagesEnabled ?? true,
                doorLeakageConfig: state.doorLeakageConfig ?? {},
                landingRoles: state.landingRoles ?? {},
                landingUpSide: state.landingUpSide ?? null,
                stairStyle: state.stairStyle ?? 'individual',
                extractConfig: state.extractConfig ?? {},
                inletConfig: state.inletConfig ?? {},
                zoneConfig: state.zoneConfig ?? {},
                sliceZHeight: state.sliceZHeight ?? 2.0,
            },
        }
    })
}

/**
 * Extract the top-level store properties to check out when switching to `floor`.
 */
export function checkoutFloorToState(floor, state, floorIndex) {
    const fs = floor.settings || {}
    const zLevel = floor.z_level ?? fs.z_level ?? 0
    const wallHeight = floor.wall_height ?? fs.wall_height ?? 3
    const elements = floor.elements || []

    return {
        activeFloorIndex: floorIndex,
        floorId: floor.id ?? null,
        elements,
        elementsByMode: {
            ...(state.elementsByMode || {}),
            [state.currentMode || 'fdsGen']: elements,
        },
        elementsHistory: floor.elementsHistory || [],
        elementsFuture: floor.elementsFuture || [],
        canvasDimensions: floor.canvas_dimensions && Object.keys(floor.canvas_dimensions).length > 0
            ? floor.canvas_dimensions
            : state.canvasDimensions,
        pixelsPerMesh: floor.pixels_per_mesh || state.pixelsPerMesh || 1,
        originPixels: floor.origin_pixels ?? null,
        fireFloorZ: zLevel,
        wallHeight: wallHeight,
        doorRoles: fs.doorRoles ?? {},
        doorLeakagesEnabled: fs.doorLeakagesEnabled ?? true,
        doorLeakageConfig: fs.doorLeakageConfig ?? {},
        landingRoles: fs.landingRoles ?? {},
        landingUpSide: fs.landingUpSide ?? null,
        stairStyle: fs.stairStyle ?? 'individual',
        extractConfig: fs.extractConfig ?? {},
        inletConfig: fs.inletConfig ?? {},
        zoneConfig: fs.zoneConfig ?? {},
        sliceZHeight: fs.sliceZHeight ?? 2.0,
        selectedElement: null,
    }
}

/**
 * Resolve a floor's reference origin in canvas pixels.
 * Defaults to `(0, canvasHeight)` (bottom-left of the sheet) when not explicitly set.
 */
export function getFloorOrigin(floor, fallbackHeight = 0) {
    if (floor?.origin_pixels && typeof floor.origin_pixels.x === 'number' && typeof floor.origin_pixels.y === 'number') {
        return { x: floor.origin_pixels.x, y: floor.origin_pixels.y }
    }
    const h = floor?.canvas_dimensions?.height || fallbackHeight || 0
    return { x: 0, y: h }
}

/**
 * Transform a 2D point `{ x, y }` from `fromFloor`'s pixel space into `toFloor`'s
 * pixel space using each floor's `origin_pixels` and `pixels_per_mesh`.
 */
export function mapPointBetweenFloors(pt, fromFloor, toFloor) {
    if (!pt || !fromFloor || !toFloor) return pt
    const fromPxPerM = (Number(fromFloor.pixels_per_mesh) || 1) * 10
    const toPxPerM = (Number(toFloor.pixels_per_mesh) || 1) * 10
    const fallbackH = toFloor.canvas_dimensions?.height || fromFloor.canvas_dimensions?.height || 0
    const fromOrigin = getFloorOrigin(fromFloor, fallbackH)
    const toOrigin = getFloorOrigin(toFloor, fallbackH)

    const dxMeters = (pt.x - fromOrigin.x) / fromPxPerM
    const dyMeters = (pt.y - fromOrigin.y) / fromPxPerM

    return {
        ...pt,
        x: toOrigin.x + dxMeters * toPxPerM,
        y: toOrigin.y + dyMeters * toPxPerM,
    }
}

/**
 * Transform all points of an element from `fromFloor` into `toFloor`'s pixel coordinates.
 */
export function transformElementBetweenFloors(el, fromFloor, toFloor) {
    if (!el || !Array.isArray(el.points)) return el
    return {
        ...el,
        points: el.points.map((p) => mapPointBetweenFloors(p, fromFloor, toFloor)),
    }
}

/**
 * Shift all `XB=x1,x2,y1,y2,z1,z2`, `XYZ=x,y,z`, `PBX=x`, and `PBY=y` coordinates
 * in an FDS line by `(dx, dy)` metres.
 */
export function offsetFdsLineXY(line, dx, dy) {
    if (!line || (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)) return line
    let out = line

    // Shift XB=x1,x2,y1,y2,z1,z2
    out = out.replace(
        /XB=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/gi,
        (_, x1, x2, y1, y2, z1, z2) => {
            const nx1 = Number(( parseFloat(x1) + dx ).toFixed(3))
            const nx2 = Number(( parseFloat(x2) + dx ).toFixed(3))
            const ny1 = Number(( parseFloat(y1) + dy ).toFixed(3))
            const ny2 = Number(( parseFloat(y2) + dy ).toFixed(3))
            return `XB=${nx1},${nx2},${ny1},${ny2},${z1},${z2}`
        }
    )

    // Shift XYZ=x,y,z
    out = out.replace(
        /XYZ=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/gi,
        (_, x, y, z) => {
            const nx = Number(( parseFloat(x) + dx ).toFixed(3))
            const ny = Number(( parseFloat(y) + dy ).toFixed(3))
            return `XYZ=${nx},${ny},${z}`
        }
    )

    // Shift PBX=x
    out = out.replace(
        /PBX=\s*([-\d.]+)/gi,
        (_, x) => `PBX=${Number(( parseFloat(x) + dx ).toFixed(3))}`
    )

    // Shift PBY=y
    out = out.replace(
        /PBY=\s*([-\d.]+)/gi,
        (_, y) => `PBY=${Number(( parseFloat(y) + dy ).toFixed(3))}`
    )

    return out
}

function snapTenth(value) {
    return Number((Math.round(Number(value) / 0.1) * 0.1).toFixed(2))
}

function footprintBoundsMetres(elements, globalMinX, globalMaxY, basePxPerM) {
    const meshEls = (elements || []).filter((el) => el && el.comments === 'mesh')
    const source = meshEls.length > 0
        ? meshEls
        : (elements || []).filter((el) => el && el.comments === 'obstruction')
    const xs = []
    const ys = []
    for (const el of source) {
        for (const p of el.points || []) {
            if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) continue
            xs.push((p.x - globalMinX) / basePxPerM)
            ys.push((globalMaxY - p.y) / basePxPerM)
        }
    }
    if (xs.length === 0 || ys.length === 0) return null
    return {
        x1: snapTenth(Math.min(...xs)),
        x2: snapTenth(Math.max(...xs)),
        y1: snapTenth(Math.min(...ys)),
        y2: snapTenth(Math.max(...ys)),
    }
}

function intersectBounds(a, b) {
    if (!a) return b
    if (!b) return a
    return {
        x1: Math.max(a.x1, b.x1),
        x2: Math.min(a.x2, b.x2),
        y1: Math.max(a.y1, b.y1),
        y2: Math.min(a.y2, b.y2),
    }
}

function isStairOrOpening(el) {
    const c = String(el?.comments || el?.comment || '')
    return c === 'floorOpening' || c === 'stairMesh'
}

/**
 * Generate a 0.2 m concrete slab `&OBST` at the join under this floor, plus
 * `&HOLE` cuts for stair / floorOpening voids. The slab XY is the overlap of
 * this floor and the floor below (not a union of the larger footprint).
 */
export function generateInterFloorSlabLines(
    floorElementsInBasePx,
    floor,
    globalMinX,
    globalMaxY,
    basePxPerM,
    slabThickness = 0.2,
    lowerFloorElementsInBasePx = []
) {
    const lines = []
    const thickness = Number.isFinite(Number(slabThickness)) ? Number(slabThickness) : 0.2
    const zLevel = Number(floor.z_level) || 0
    const zBottom = Number((zLevel - thickness).toFixed(3))
    const zTop = Number(zLevel.toFixed(3))

    const upperBounds = footprintBoundsMetres(
        floorElementsInBasePx, globalMinX, globalMaxY, basePxPerM
    )
    const lowerBounds = footprintBoundsMetres(
        lowerFloorElementsInBasePx, globalMinX, globalMaxY, basePxPerM
    )
    const join = intersectBounds(upperBounds, lowerBounds)
    if (!join || !(join.x2 > join.x1 && join.y2 > join.y1)) return lines

    const floorLabel = (floor.name || `Floor_${floor.floor_number}`).replace(/'/g, '')
    lines.push(
        `&OBST ID='${floorLabel} Slab', XB=${join.x1},${join.x2},${join.y1},${join.y2},${zBottom},${zTop}, SURF_ID='Concrete', RGB=168,163,155, TRANSPARENCY=0.2/`
    )

    const openingEls = [
        ...(floorElementsInBasePx || []),
        ...(lowerFloorElementsInBasePx || []),
    ].filter(isStairOrOpening)

    openingEls.forEach((el, idx) => {
        const oxs = (el.points || []).map((p) => (p.x - globalMinX) / basePxPerM)
        const oys = (el.points || []).map((p) => (globalMaxY - p.y) / basePxPerM)
        if (oxs.length < 2 || oys.length < 2) return
        const hx1 = snapTenth(Math.min(...oxs))
        const hx2 = snapTenth(Math.max(...oxs))
        const hy1 = snapTenth(Math.min(...oys))
        const hy2 = snapTenth(Math.max(...oys))
        if (!(hx2 > hx1 && hy2 > hy1)) return
        const hz1 = Number((zBottom - 0.05).toFixed(3))
        const hz2 = Number((zTop + 0.05).toFixed(3))
        const kind = String(el.comments || el.comment || '') === 'stairMesh' ? 'Stair Opening' : 'Floor Opening'
        lines.push(
            `&HOLE ID='${kind} ${idx + 1}', XB=${hx1},${hx2},${hy1},${hy2},${hz1},${hz2}/`
        )
    })

    return lines
}

function localMeshId(id) {
    return String(id || '').replace(/^F\d+_/, '')
}

function snapToGrid(value, origin, cell) {
    const c = Number(cell) || 0.1
    const o = Number(origin) || 0
    return Number((o + Math.round((Number(value) - o) / c) * c).toFixed(6))
}

/**
 * Snap each stacked MESH to the lowest floor's cell grid without changing
 * which floor owns it or forcing identical XY. A larger ground mesh may stick
 * out; the smaller upper mesh stays smaller. Overlap bounds land on cell faces
 * so FDS/PyroSim vertical interfaces meet. Meshes never span two floors.
 */
export function alignStackedMeshesInFds(fdsText) {
    if (!fdsText || typeof fdsText !== 'string') return fdsText
    const meshRe = /&MESH\b[\s\S]*?\//gi
    const meshes = []
    let match
    while ((match = meshRe.exec(fdsText)) !== null) {
        const rec = match[0]
        const id = rec.match(/ID='([^']+)'/i)?.[1]
        const ijk = rec.match(/IJK=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/i)
        const xb = rec.match(
            /XB=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/i
        )
        if (!id || !ijk || !xb) continue
        meshes.push({
            id,
            localId: localMeshId(id),
            i: Number(ijk[1]),
            j: Number(ijk[2]),
            k: Number(ijk[3]),
            xmin: Number(xb[1]),
            xmax: Number(xb[2]),
            ymin: Number(xb[3]),
            ymax: Number(xb[4]),
            zmin: Number(xb[5]),
            zmax: Number(xb[6]),
            index: match.index,
            length: rec.length,
            rec,
        })
    }
    if (meshes.length < 2) return fdsText

    const groups = new Map()
    for (const mesh of meshes) {
        const key = mesh.localId || mesh.id
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(mesh)
    }

    const replacements = []
    for (const group of groups.values()) {
        const zKeys = new Set(group.map((g) => Number(g.zmin.toFixed(4))))
        if (group.length < 2 || zKeys.size < 2) continue

        const ref = [...group].sort((a, b) => a.zmin - b.zmin)[0]
        const cellX = Math.abs(ref.xmax - ref.xmin) / Math.max(1, ref.i) || 0.1
        const cellY = Math.abs(ref.ymax - ref.ymin) / Math.max(1, ref.j) || 0.1
        const originX = Math.min(ref.xmin, ref.xmax)
        const originY = Math.min(ref.ymin, ref.ymax)

        for (const mesh of group) {
            let xmin = snapToGrid(Math.min(mesh.xmin, mesh.xmax), originX, cellX)
            let xmax = snapToGrid(Math.max(mesh.xmin, mesh.xmax), originX, cellX)
            let ymin = snapToGrid(Math.min(mesh.ymin, mesh.ymax), originY, cellY)
            let ymax = snapToGrid(Math.max(mesh.ymin, mesh.ymax), originY, cellY)
            if (xmax <= xmin) xmax = xmin + cellX
            if (ymax <= ymin) ymax = ymin + cellY
            const i = Math.max(1, Math.round((xmax - xmin) / cellX))
            const j = Math.max(1, Math.round((ymax - ymin) / cellY))
            xmax = Number((xmin + i * cellX).toFixed(6))
            ymax = Number((ymin + j * cellY).toFixed(6))
            const next = mesh.rec
                .replace(/IJK=\s*[-\d.]+,\s*[-\d.]+,\s*[-\d.]+/i, `IJK=${i},${j},${mesh.k}`)
                .replace(
                    /XB=\s*[-\d.]+,\s*[-\d.]+,\s*[-\d.]+,\s*[-\d.]+,\s*[-\d.]+,\s*[-\d.]+/i,
                    `XB=${xmin},${xmax},${ymin},${ymax},${mesh.zmin},${mesh.zmax}`
                )
            replacements.push({ index: mesh.index, length: mesh.length, next })
        }
    }

    if (replacements.length === 0) return fdsText
    replacements.sort((a, b) => b.index - a.index)
    let out = fdsText
    for (const r of replacements) {
        out = out.slice(0, r.index) + r.next + out.slice(r.index + r.length)
    }
    return out
}

/**
 * Combine multiple per-floor FDS outputs into a single valid multi-floor FDS input file.
 * Deduplicates singleton namelists (&HEAD, &TIME, &DUMP, &COMB, &MATL, Plasterboard &SURF,
 * &REAC, &TAIL), prefixes floor-specific IDs to avoid collisions, applies each floor's
 * global (dx, dy) offset, inserts inter-floor slab &OBST / &HOLE lines, then snaps
 * stacked mesh bounds onto a shared cell grid at the XY overlap (sizes stay
 * per-floor; a larger mesh may stick out).
 */
export function combineMultiFloorFds(floorRuns, options = {}) {
    if (!Array.isArray(floorRuns) || floorRuns.length === 0) return ''
    if (floorRuns.length === 1 && (!floorRuns[0].slabLines || floorRuns[0].slabLines.length === 0)) {
        return floorRuns[0].fdsText || ''
    }

    const combinedLines = []
    const seenBlocks = new Set()

    // Split FDS text into logical namelist records (handling multi-line &SURF / &MATL / &REAC)
    const splitNamelists = (text) => {
        const records = []
        const rawLines = (text || '').split(/\r?\n/)
        let current = []
        for (const raw of rawLines) {
            const trimmed = raw.trim()
            if (!trimmed) continue
            if (trimmed.startsWith('&') && current.length > 0) {
                records.push(current.join('\n'))
                current = [raw]
            } else {
                current.push(raw)
                if (trimmed.endsWith('/')) {
                    records.push(current.join('\n'))
                    current = []
                }
            }
        }
        if (current.length > 0) records.push(current.join('\n'))
        return records
    }

    floorRuns.forEach((run, runIdx) => {
        const { floor, fdsText, dx = 0, dy = 0, slabLines = [] } = run
        const floorPrefix = `F${floor?.floor_number ?? run.floorNumber ?? runIdx}_`
        const records = splitNamelists(fdsText)

        for (const rec of records) {
            const upper = rec.trim().toUpperCase()
            if (upper.startsWith('&TAIL')) continue

            const isSingleton =
                upper.startsWith('&HEAD') ||
                upper.startsWith('&TIME') ||
                upper.startsWith('&DUMP') ||
                upper.startsWith('&COMB') ||
                upper.startsWith('&MATL') ||
                upper.startsWith('&REAC') ||
                (upper.startsWith('&SURF') && upper.includes("ID='PLASTERBOARD'")) ||
                (upper.startsWith('&SURF') && upper.includes("ID='FIRE'")) ||
                upper.startsWith('&RAMP') ||
                upper.startsWith('&PROP')

            if (isSingleton) {
                const key = upper.replace(/\s+/g, ' ')
                if (seenBlocks.has(key)) continue
                seenBlocks.add(key)
                combinedLines.push(rec)
                continue
            }

            // Offset XY coordinates to global world space
            let shifted = offsetFdsLineXY(rec, dx, dy)

            // Prefix Mesh IDs and Obstruction IDs when multiple floors exist so they are distinct
            if (floorRuns.length > 1) {
                if (upper.startsWith('&MESH')) {
                    shifted = shifted.replace(/ID='([^']+)'/i, `ID='${floorPrefix}$1'`)
                }
            }

            combinedLines.push(shifted)
        }

        for (const slabLine of slabLines) {
            combinedLines.push(slabLine)
        }
    })

    combinedLines.push('&TAIL/')
    const withSurf = ensureConcreteSurf(combinedLines)
    const combined = withSurf.join('\n')
    if (options.alignStackedMeshes === false) return combined
    return alignStackedMeshesInFds(combined)
}

const CONCRETE_MATL =
    "&MATL ID='CONCRETE', SPECIFIC_HEAT=0.88, CONDUCTIVITY=1.4, DENSITY=2300.0/"
const CONCRETE_SURF =
    "&SURF ID='Concrete', RGB=168,163,155, MATL_ID='CONCRETE', THICKNESS=0.2/"

function ensureConcreteSurf(lines) {
    const text = lines.join('\n')
    if (!/SURF_ID='Concrete'/i.test(text)) return lines
    const hasSurf = /&SURF\b[\s\S]*?ID='Concrete'/i.test(text)
    const hasMatl = /&MATL\b[\s\S]*?ID='CONCRETE'/i.test(text)
    if (hasSurf && hasMatl) return lines
    const insertAt = lines.findIndex((l) => /^\s*&MESH\b/i.test(l))
    const idx = insertAt >= 0 ? insertAt : 1
    const extra = []
    if (!hasMatl) extra.push(CONCRETE_MATL)
    if (!hasSurf) extra.push(CONCRETE_SURF)
    return [...lines.slice(0, idx), ...extra, ...lines.slice(idx)]
}
