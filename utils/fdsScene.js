// Turn parsed FDS geometry (see fdsParse.js) into a flat list of drawable
// primitives, decoupled from three.js so it can be unit-tested without WebGL.
// Scene3D.jsx consumes this and instantiates the actual meshes.
//
// Coordinate note: FDS is Z-up (x east, y north, z up). three.js is Y-up, so
// Scene3D maps FDS (x,y,z) -> three (x, z, -y). That mapping lives in the
// renderer; here everything stays in honest FDS metres.

// Default colours (0-255 RGB) per namelist when the FDS file doesn't specify one.
const DEFAULTS = {
    obst: [120, 144, 156],   // slate — generic obstruction
    vent: [255, 152, 0],     // amber — vent face
    hole: [239, 83, 80],     // red — subtractive hole
    device: [0, 230, 118],   // green — sensor/device marker
    mesh: [120, 130, 150],   // muted — domain wireframe
}

// Normalise an FDS XB sextet to a box: centre + positive size, plus the raw
// min/max. FDS allows degenerate (zero-thickness) boxes for faces/vents; we
// give those a thin visible thickness so they still render as a slab.
function xbToBox(xb, { minThickness = 0.02 } = {}) {
    const lo = [Math.min(xb[0], xb[1]), Math.min(xb[2], xb[3]), Math.min(xb[4], xb[5])]
    const hi = [Math.max(xb[0], xb[1]), Math.max(xb[2], xb[3]), Math.max(xb[4], xb[5])]
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((s) => Math.max(s, minThickness))
    const center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
    return { center, size }
}

const rgbToHex = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]

// Build the primitive list. Each item: { kind, center:[x,y,z], size:[x,y,z],
// color (hex int), opacity, wireframe (bool), label }.
export function buildFdsScene(parsed, opts = {}) {
    const items = []
    if (!parsed) return { items, bounds: null }

    // Mesh domains: translucent wireframe boxes so they read as bounds, not solids.
    parsed.meshes.forEach((mesh, i) => {
        const { center, size } = xbToBox(mesh.xb, { minThickness: 0 })
        items.push({
            kind: 'mesh', center, size,
            color: rgbToHex(DEFAULTS.mesh), opacity: 1, wireframe: true,
            label: `MESH ${i + 1}${mesh.ijk ? ` (${mesh.ijk.join('x')})` : ''}`,
        })
    })

    // Obstructions: solid boxes, FDS colour or slate default. Honour an explicit
    // INVISIBLE colour (null) by skipping — that's what it means in FDS.
    parsed.obsts.forEach((obst) => {
        if (obst.color === null && /invisible/i.test(obst.surfId || '')) return
        const { center, size } = xbToBox(obst.xb)
        items.push({
            kind: 'obst', center, size,
            color: rgbToHex(obst.color || DEFAULTS.obst), opacity: 1, wireframe: false,
            label: obst.surfId || 'OBST',
        })
    })

    // Vents: thin coloured slabs (a face).
    parsed.vents.forEach((vent) => {
        const { center, size } = xbToBox(vent.xb)
        items.push({
            kind: 'vent', center, size,
            color: rgbToHex(vent.color || DEFAULTS.vent), opacity: 0.55, wireframe: false,
            label: vent.surfId || 'VENT',
        })
    })

    // Holes: translucent red wireframe (subtractive — shown for awareness).
    parsed.holes.forEach((hole) => {
        const { center, size } = xbToBox(hole.xb)
        items.push({
            kind: 'hole', center, size,
            color: rgbToHex(hole.color || DEFAULTS.hole), opacity: 0.35, wireframe: true,
            label: 'HOLE',
        })
    })

    // Devices: small cube markers at the XYZ point.
    const markerSize = opts.deviceMarkerSize || 0.15
    parsed.devices.forEach((d) => {
        items.push({
            kind: 'device',
            center: [d.xyz[0], d.xyz[1], d.xyz[2]],
            size: [markerSize, markerSize, markerSize],
            color: rgbToHex(DEFAULTS.device), opacity: 1, wireframe: false,
            label: d.id || d.quantity || 'DEVC',
        })
    })

    return { items, bounds: parsed.bounds }
}
