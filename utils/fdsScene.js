// Turn parsed FDS geometry (see fdsParse.js) into a flat list of drawable
// primitives, decoupled from three.js so it can be unit-tested without WebGL.
// Scene3D.jsx consumes this and instantiates the actual meshes.
//
// Coordinate note: FDS is Z-up (x east, y north, z up). three.js is Y-up, so
// Scene3D maps FDS (x,y,z) -> three (x, z, -y). That mapping lives in the
// renderer; here everything stays in honest FDS metres.
//
// Each item carries a `category` so the renderer can group items and the
// visibility panel can toggle whole categories. Categories:
//   mesh · obst · fire · vent · domainVent · hole · device
// Devices also carry `quantity` for per-quantity sub-toggles + colouring.

// Default colours (0-255 RGB) per category when the FDS doesn't specify one.
const DEFAULTS = {
    obst: [200, 200, 205],   // light grey — generic wall
    fire: [255, 87, 34],     // orange — fire source
    vent: [3, 169, 244],     // blue — interior vent
    domainVent: [120, 130, 150],
    hole: [239, 83, 80],     // red — subtractive hole (door/damper)
    device: [0, 230, 118],   // green — fallback device marker
    mesh: [120, 130, 150],   // muted — domain wireframe
}

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
                emissive: true, label: obst.id || 'Fire',
            })
            return
        }
        // FDS TRANSPARENCY is an alpha (1 = opaque, 0.247 = mostly see-through).
        const baseOpacity = obst.transparency == null ? 1 : Math.max(0.05, Math.min(1, obst.transparency))
        items.push({
            category: 'obst', center, size,
            color: rgbToHex(obst.color || DEFAULTS.obst),
            opacity: baseOpacity, baseOpacity, wireframe: false,
            label: obst.id || obst.surfId || 'OBST',
        })
    })

    // Vents: interior vents are thin coloured slabs; mesh-boundary (domain)
    // vents go in their own category so the panel can hide them by default.
    parsed.vents.forEach((vent) => {
        const { center, size } = xbToBox(vent.xb)
        const domain = vent.isDomainVent
        items.push({
            category: domain ? 'domainVent' : 'vent', center, size,
            color: rgbToHex(domain ? DEFAULTS.domainVent : ventColor(vent)),
            opacity: domain ? 0.18 : 0.55, baseOpacity: domain ? 0.18 : 0.55, wireframe: false,
            label: vent.id || vent.surfId || 'VENT',
        })
    })

    // Holes: translucent red wireframe (subtractive — doors/dampers).
    parsed.holes.forEach((hole) => {
        const { center, size } = xbToBox(hole.xb)
        items.push({
            category: 'hole', center, size,
            color: rgbToHex(hole.color || DEFAULTS.hole), opacity: 0.4, baseOpacity: 0.4, wireframe: true,
            label: 'HOLE',
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
