// Turn parsed FDS geometry (see fdsParse.js) into a flat list of drawable
// primitives, decoupled from three.js so it can be unit-tested without WebGL.
// Scene3D.jsx consumes this and instantiates the actual meshes.
//
// Coordinate note: FDS is Z-up (x east, y north, z up). three.js is Y-up, so
// Scene3D maps FDS (x,y,z) -> three (x, z, y) (see utils/fdsThree) so the
// top-down 3D reproduces the 2D canvas the user drew (+x right, +y down). That
// mapping lives in the renderer; here everything stays in honest FDS metres.
//
// Each item carries a `category` so the renderer can group items and the
// visibility panel can toggle whole categories. Categories:
//   mesh · obst · fire · vent · domainVent · hole · device
// Devices also carry `quantity` for per-quantity sub-toggles + colouring.

// Default colours (0-255 RGB) per category when the FDS doesn't specify one.
const DEFAULTS = {
    obst: [200, 200, 205],   // light grey — generic wall
    fire: [255, 87, 34],     // orange — fire source
    door: [150, 95, 45],     // wood — door leaf (fills the opening HOLE)
    doorLeak: [255, 213, 79], // amber highlight — leakage/vent gap on a door
    vent: [3, 169, 244],     // blue — interior vent
    domainVent: [120, 130, 150],
    hole: [239, 83, 80],     // red — subtractive hole (generic opening / damper)
    device: [0, 230, 118],   // green — fallback device marker
    mesh: [120, 130, 150],   // muted — domain wireframe
}

// A door's opening (HOLE) and its leakage gaps (VENT) are both ID'd with 'door'.
const isDoorLike = (id) => /\bdoor\b/i.test(normId(id))

// Colour devices by what they measure, so a sensor cloud reads at a glance.
const QUANTITY_COLORS = {
    TEMPERATURE: [255, 112, 67],
    VELOCITY: [66, 165, 245],
    'U-VELOCITY': [66, 165, 245],
    'V-VELOCITY': [66, 165, 245],
    'W-VELOCITY': [66, 165, 245],
    VISIBILITY: [102, 187, 106],
    PRESSURE: [255, 213, 79],
    'LAYER HEIGHT': [171, 71, 188],
    'HRR': [255, 87, 34],
}
const DEVICE_FALLBACK = DEFAULTS.device

// Vent SURF_ID -> colour (interior vents). OPEN = blue, extract = red, else grey.
function ventColor(vent) {
    if (vent.color) return vent.color
    const s = (vent.surfId || '').toLowerCase()
    if (s.includes('extract')) return [239, 83, 80]
    if (s.includes('open')) return [3, 169, 244]
    return DEFAULTS.vent
}

function quantityColor(q) {
    if (!q) return DEVICE_FALLBACK
    return QUANTITY_COLORS[q.toUpperCase()] || DEVICE_FALLBACK
}

// Normalise an FDS XB sextet to a box: centre + positive size. FDS allows
// degenerate (zero-thickness) boxes for faces/vents; give those a thin visible
// thickness so they still render as a slab.
function xbToBox(xb, { minThickness = 0.02 } = {}) {
    const lo = [Math.min(xb[0], xb[1]), Math.min(xb[2], xb[3]), Math.min(xb[4], xb[5])]
    const hi = [Math.max(xb[0], xb[1]), Math.max(xb[2], xb[3]), Math.max(xb[4], xb[5])]
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((s) => Math.max(s, minThickness))
    const center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
    return { center, size }
}

const rgbToHex = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]

// Which FDS IDs are worth a floating label in 3D, and how to prettify them.
// The door geometry is emitted with machine IDs (HOLE 'HoleStair_door_side',
// dampers, etc.) — the friendly door names live on &CTRL logic, not geometry.
// So we derive a readable label from the geometry ID: split on underscores,
// keep the door/damper/aov/extract/inlet ones, drop the noise (leakage vents,
// ramps, mesh vents, 'side'/'hole'/stray digits).
const NAME_INCLUDE = /\b(door|damper|aov|extract|inlet)\b/i
const NAME_EXCLUDE = /\b(leak|ramp|vent)\b|mesh/i
const normId = (id) => (id || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

function isNamed(id) {
    const n = normId(id)
    return !!n && NAME_INCLUDE.test(n) && !NAME_EXCLUDE.test(n)
}

// 'HoleStair_door_side' -> 'Stair Door'; 'East Lobby Natural Damper' kept as-is.
function prettyLabel(id) {
    const n = normId(id)
        .replace(/\b(hole|side)\b/gi, '')
        .replace(/\b\d+\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    return n.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Build the primitive list. Each item:
//   { category, center:[x,y,z], size:[x,y,z], color (hex), opacity, wireframe,
//     baseOpacity, quantity?, label }
// `baseOpacity` is the FDS-honoured opacity; the renderer's X-ray toggle drives
// the live opacity below it without losing the original.
export function buildFdsScene(parsed, opts = {}) {
    const items = []
    if (!parsed) return { items, bounds: null, quantities: [] }

    // Mesh domains: translucent wireframe boxes so they read as bounds.
    parsed.meshes.forEach((mesh, i) => {
        const { center, size } = xbToBox(mesh.xb, { minThickness: 0 })
        items.push({
            category: 'mesh', center, size,
            color: rgbToHex(DEFAULTS.mesh), opacity: 1, baseOpacity: 1, wireframe: true,
            label: `MESH ${i + 1}${mesh.ijk ? ` (${mesh.ijk.join('x')})` : ''}`,
        })
    })

    // Obstructions. Fire is split out as its own always-loud category; other
    // walls follow their FDS RGB + TRANSPARENCY (ground truth).
    parsed.obsts.forEach((obst) => {
        if (obst.color === null && /invisible/i.test(obst.surfId || '')) return
        const { center, size } = xbToBox(obst.xb)
        if (obst.isFire) {
            items.push({
                category: 'fire', center, size,
                color: rgbToHex(DEFAULTS.fire), opacity: 1, baseOpacity: 1, wireframe: false,
                emissive: true, label: 'Fire', named: true,
            })
            return
        }
        // FDS TRANSPARENCY is an alpha (1 = opaque, 0.247 = mostly see-through).
        const baseOpacity = obst.transparency == null ? 1 : Math.max(0.05, Math.min(1, obst.transparency))
        items.push({
            category: 'obst', center, size,
            color: rgbToHex(obst.color || DEFAULTS.obst),
            opacity: baseOpacity, baseOpacity, wireframe: false,
            label: obst.id || obst.surfId || 'OBST', named: isNamed(obst.id),
        })
    })

    // Vents. Mesh-boundary (domain) vents get their own hidden-by-default
    // category. Door leakage/bottom vents become a bright "door leak" highlight
    // overlaid on the door. Everything else is an interior vent slab.
    parsed.vents.forEach((vent) => {
        const { center, size } = xbToBox(vent.xb)
        if (vent.isDomainVent) {
            items.push({
                category: 'domainVent', center, size,
                color: rgbToHex(DEFAULTS.domainVent), opacity: 0.18, baseOpacity: 0.18, wireframe: false,
                label: vent.id || 'VENT', named: false,
            })
            return
        }
        if (isDoorLike(vent.id)) {
            items.push({
                category: 'doorLeak', center, size,
                color: rgbToHex(DEFAULTS.doorLeak), opacity: 0.95, baseOpacity: 0.95, wireframe: false,
                emissive: true, overlay: true, label: 'leak', named: false,
            })
            return
        }
        items.push({
            category: 'vent', center, size,
            color: rgbToHex(ventColor(vent)), opacity: 0.55, baseOpacity: 0.55, wireframe: false,
            label: vent.id || vent.surfId || 'VENT', named: isNamed(vent.id),
        })
    })

    // Holes. A door opening (HOLE) is rendered as a wooden door leaf filling it;
    // other holes (dampers, generic openings) stay red wireframe.
    parsed.holes.forEach((hole) => {
        const { center, size } = xbToBox(hole.xb)
        if (isDoorLike(hole.id)) {
            items.push({
                category: 'door', center, size,
                color: rgbToHex(DEFAULTS.door), opacity: 0.9, baseOpacity: 0.9, wireframe: false,
                label: prettyLabel(hole.id), named: true,
            })
            return
        }
        items.push({
            category: 'hole', center, size,
            color: rgbToHex(hole.color || DEFAULTS.hole), opacity: 0.4, baseOpacity: 0.4, wireframe: true,
            label: isNamed(hole.id) ? prettyLabel(hole.id) : 'HOLE', named: isNamed(hole.id),
        })
    })

    // Devices: small cube markers at XYZ, coloured by QUANTITY.
    const markerSize = opts.deviceMarkerSize || 0.15
    parsed.devices.forEach((d) => {
        items.push({
            category: 'device',
            quantity: d.quantity || 'OTHER',
            center: [d.xyz[0], d.xyz[1], d.xyz[2]],
            size: [markerSize, markerSize, markerSize],
            color: rgbToHex(quantityColor(d.quantity)), opacity: 1, baseOpacity: 1, wireframe: false,
            label: d.id || d.quantity || 'DEVC',
        })
    })

    // Distinct device quantities present, for per-quantity sub-toggles.
    const quantities = [...new Set(parsed.devices.map((d) => (d.quantity || 'OTHER').toUpperCase()))].sort()

    return { items, bounds: parsed.bounds, quantities }
}
