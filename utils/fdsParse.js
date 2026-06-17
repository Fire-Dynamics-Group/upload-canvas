// Parse the geometry out of an FDS input file (the text the backend returns)
// into plain axis-aligned boxes + point markers, in FDS world metres. The 3D
// view renders these directly, so what you see is ground truth — the geometry
// FDS will actually simulate — rather than a re-extrusion of the 2D drawing.
//
// FDS geometry is conveniently box-based: OBST/MESH/VENT/HOLE all carry an
// `XB=x0,x1,y0,y1,z0,z1` sextet, and DEVC carries an `XYZ=x,y,z` point. That
// maps one-to-one onto three.js boxes/markers.
//
// Limitations (documented on purpose, see fdsParse.test.js):
//  - A namelist is read up to its first `/`. A `/` inside a quoted string would
//    truncate it early; that doesn't occur in the geometry namelists we emit.
//  - VENT/MESH faces given by MB= (mesh-boundary keyword) rather than XB= are
//    skipped — they have no explicit box to draw.

// Smokeview's standard named colours (the common subset FDS files use). Values
// are 0-255 RGB. Unknown names fall back to a per-namelist default.
export const FDS_NAMED_COLORS = {
    RED: [255, 0, 0],
    GREEN: [0, 128, 0],
    BLUE: [0, 0, 255],
    ORANGE: [255, 165, 0],
    YELLOW: [255, 255, 0],
    CYAN: [0, 255, 255],
    MAGENTA: [255, 0, 255],
    PURPLE: [128, 0, 128],
    WHITE: [255, 255, 255],
    BLACK: [0, 0, 0],
    GRAY: [128, 128, 128],
    GREY: [128, 128, 128],
    'LIGHT GRAY': [200, 200, 200],
    'LIGHT GREY': [200, 200, 200],
    SILVER: [192, 192, 192],
    BROWN: [165, 42, 42],
    PINK: [255, 192, 203],
    GOLD: [255, 215, 0],
    'SKY BLUE': [135, 206, 235],
    'FOREST GREEN': [34, 139, 34],
    INVISIBLE: null,
}

// Read the first `count` numbers that follow `KEY=` inside a namelist body.
// Returns an array of numbers, or null if the key is absent / has too few.
function readNumbers(body, key, count) {
    const at = new RegExp(`\\b${key}\\s*=`, 'i').exec(body)
    if (!at) return null
    const rest = body.slice(at.index + at[0].length)
    const nums = rest.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)
    if (!nums || nums.length < count) return null
    return nums.slice(0, count).map(Number)
}

// Read a quoted string value: KEY='value' or KEY="value".
function readString(body, key) {
    const m = new RegExp(`\\b${key}\\s*=\\s*['"]([^'"]+)['"]`, 'i').exec(body)
    return m ? m[1] : null
}

// Resolve a namelist's colour to [r,g,b] (0-255), or null if none/invisible.
// RGB= wins over COLOR= (FDS evaluates it the same way).
function readColor(body) {
    const rgb = /\bRGB\s*=\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(body)
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
    const named = readString(body, 'COLOR')
    if (named) {
        const key = named.toUpperCase().replace(/\s+/g, ' ').trim()
        if (key in FDS_NAMED_COLORS) return FDS_NAMED_COLORS[key]
    }
    return null
}

// Parse FDS text into geometry buckets. Pure; safe to run anywhere (no DOM).
export function parseFdsGeometry(fdsText) {
    const result = { meshes: [], obsts: [], vents: [], holes: [], devices: [], bounds: null }
    if (!fdsText || typeof fdsText !== 'string') return result

    const blockRe = /&(\w+)([\s\S]*?)\//g
    let m
    while ((m = blockRe.exec(fdsText)) !== null) {
        const group = m[1].toUpperCase()
        const body = m[2]
        switch (group) {
            case 'OBST': {
                const xb = readNumbers(body, 'XB', 6)
                if (xb) result.obsts.push({ xb, color: readColor(body), surfId: readString(body, 'SURF_ID') })
                break
            }
            case 'MESH': {
                const xb = readNumbers(body, 'XB', 6)
                if (xb) result.meshes.push({ xb, ijk: readNumbers(body, 'IJK', 3) })
                break
            }
            case 'VENT': {
                const xb = readNumbers(body, 'XB', 6)
                if (xb) result.vents.push({ xb, color: readColor(body), surfId: readString(body, 'SURF_ID') })
                break
            }
            case 'HOLE': {
                const xb = readNumbers(body, 'XB', 6)
                if (xb) result.holes.push({ xb, color: readColor(body) })
                break
            }
            case 'DEVC': {
                const xyz = readNumbers(body, 'XYZ', 3)
                if (xyz) result.devices.push({ xyz, quantity: readString(body, 'QUANTITY'), id: readString(body, 'ID') })
                break
            }
            default:
                break
        }
    }

    result.bounds = computeBounds(result)
    return result
}

// Overall bounding box across all parsed geometry, for camera framing. Meshes
// define the simulated domain, so if present they alone set the bounds; only
// when there are no meshes do we fall back to obstruction/device extents.
export function computeBounds(parsed) {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    const eat = (xb) => {
        for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], xb[a * 2], xb[a * 2 + 1])
            max[a] = Math.max(max[a], xb[a * 2], xb[a * 2 + 1])
        }
    }
    const sources = parsed.meshes.length ? parsed.meshes : [...parsed.obsts, ...parsed.vents, ...parsed.holes]
    sources.forEach((s) => eat(s.xb))
    if (!parsed.meshes.length) {
        parsed.devices.forEach((d) => eat([d.xyz[0], d.xyz[0], d.xyz[1], d.xyz[1], d.xyz[2], d.xyz[2]]))
    }
    if (min[0] === Infinity) return null
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
    return { min, max, center, size }
}

// Counts for the view's header/legend.
export function summarizeFds(parsed) {
    return {
        meshes: parsed.meshes.length,
        obsts: parsed.obsts.length,
        vents: parsed.vents.length,
        holes: parsed.holes.length,
        devices: parsed.devices.length,
    }
}
