import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseFdsGeometry, summarizeFds } from '../utils/fdsParse'
import { buildFdsScene } from '../utils/fdsScene'

// Integration check against REAL backend output. The risk in this feature is the
// parse -> scene data mapping, not three.js drawing boxes, so we validate the
// pipeline end-to-end on the actual reference FDS files the backend produces.
const REFERENCES = [
    'reference-FS11_A2_1_092_MLNL_NCC.fds',
    'reference-FS2_Plot84_FSA_WIP.fds',
]

describe.each(REFERENCES)('reference FDS pipeline: %s', (file) => {
    const text = readFileSync(join(__dirname, '..', 'docs', file), 'utf-8')
    const parsed = parseFdsGeometry(text)
    const scene = buildFdsScene(parsed)

    it('parses a substantial, non-empty model', () => {
        const c = summarizeFds(parsed)
        expect(c.obsts).toBeGreaterThan(50)
        expect(c.meshes).toBeGreaterThan(0)
        expect(scene.items.length).toBeGreaterThan(50)
        expect(scene.bounds).not.toBeNull()
    })

    it('detects exactly one fire source and categorises it', () => {
        const fire = scene.items.filter((i) => i.category === 'fire')
        expect(fire.length).toBe(1)
        expect(fire[0].opacity).toBe(1) // fire is always solid/visible
    })

    it('separates domain vents, interior vents and door leaks', () => {
        const domain = scene.items.filter((i) => i.category === 'domainVent')
        const interior = scene.items.filter((i) => i.category === 'vent')
        const doorLeak = scene.items.filter((i) => i.category === 'doorLeak')
        expect(domain.length).toBeGreaterThan(0)              // these models have mesh vents
        // every parsed VENT lands in exactly one of the three buckets
        expect(domain.length + interior.length + doorLeak.length).toBe(parsed.vents.length)
    })

    it('renders door openings as wooden doors with readable labels', () => {
        const doors = scene.items.filter((i) => i.category === 'door')
        expect(doors.length).toBeGreaterThan(0)
        expect(doors.every((d) => d.named && d.label && !/_/.test(d.label))).toBe(true)
    })

    it('honours wall TRANSPARENCY (some obstructions are see-through)', () => {
        const obsts = scene.items.filter((i) => i.category === 'obst')
        expect(obsts.some((o) => o.baseOpacity < 1)).toBe(true)
    })

    it('discovers device quantities for the panel sub-toggles', () => {
        if (parsed.devices.length > 0) {
            expect(scene.quantities.length).toBeGreaterThan(0)
            expect(scene.quantities).toContain('TEMPERATURE')
        }
    })

    it('carries named door/element labels straight from FDS IDs', () => {
        const named = scene.items.filter((i) => i.named)
        expect(named.length).toBeGreaterThan(0)
        // these models have named doors (e.g. 'Apartment Door', 'East Stair Door')
        expect(named.some((i) => /door/i.test(i.label))).toBe(true)
        // noisy machine-named bits are not labelled
        expect(named.every((i) => !/_RAMP|bottom (leak|vent)|Mesh Vent/i.test(i.label))).toBe(true)
    })

    it('frames within the mesh domain (finite, sane bounds)', () => {
        const { min, max } = scene.bounds
        for (let a = 0; a < 3; a++) {
            expect(Number.isFinite(min[a])).toBe(true)
            expect(Number.isFinite(max[a])).toBe(true)
            expect(max[a]).toBeGreaterThanOrEqual(min[a])
        }
    })
})
