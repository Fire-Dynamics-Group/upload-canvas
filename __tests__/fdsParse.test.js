import { describe, it, expect } from 'vitest'
import { parseFdsGeometry, computeBounds, summarizeFds, FDS_NAMED_COLORS } from '../utils/fdsParse'

// A small but representative FDS fragment: one mesh, two obstructions (one with
// a named colour, one with RGB), a vent, a hole, and a couple of devices. Mixed
// spacing, multi-line namelists, and trailing comments mirror real backend output.
const SAMPLE = `
&HEAD CHID='test', TITLE='demo' /
&TIME T_END=300.0 /

&MESH IJK=50,40,30 XB=0.0,5.0,0.0,4.0,0.0,3.0 /

&OBST XB=1.0,2.0, 1.0,3.0, 0.0,3.0 SURF_ID='WALL' COLOR='GRAY' /  a wall
&OBST XB=3.0,3.2,0.0,4.0,0.0,3.0,
      RGB=12,34,56, SURF_ID='INERT' /

&VENT XB=0.0,0.0,0.0,4.0,0.0,3.0, SURF_ID='OPEN' /
&HOLE XB=1.4,1.6,1.0,1.2,0.0,2.1 /

&DEVC ID='temp_1', XYZ=2.5,2.0,2.0, QUANTITY='TEMPERATURE' /
&DEVC ID='velo_1', XYZ=2.5,2.0,2.0, QUANTITY='VELOCITY' /

&TAIL /
`

describe('parseFdsGeometry', () => {
    const parsed = parseFdsGeometry(SAMPLE)

    it('parses the mesh domain with XB and IJK', () => {
        expect(parsed.meshes).toHaveLength(1)
        expect(parsed.meshes[0].xb).toEqual([0, 5, 0, 4, 0, 3])
        expect(parsed.meshes[0].ijk).toEqual([50, 40, 30])
    })

    it('parses obstructions including multi-line and trailing text', () => {
        expect(parsed.obsts).toHaveLength(2)
        expect(parsed.obsts[0].xb).toEqual([1, 2, 1, 3, 0, 3])
        expect(parsed.obsts[0].surfId).toBe('WALL')
        expect(parsed.obsts[1].xb).toEqual([3, 3.2, 0, 4, 0, 3])
    })

    it('resolves named COLOR and explicit RGB', () => {
        expect(parsed.obsts[0].color).toEqual(FDS_NAMED_COLORS.GRAY)
        expect(parsed.obsts[1].color).toEqual([12, 34, 56])
    })

    it('parses vents and holes', () => {
        expect(parsed.vents).toHaveLength(1)
        expect(parsed.vents[0].xb).toEqual([0, 0, 0, 4, 0, 3])
        expect(parsed.holes).toHaveLength(1)
        expect(parsed.holes[0].xb).toEqual([1.4, 1.6, 1, 1.2, 0, 2.1])
    })

    it('parses devices as XYZ point markers', () => {
        expect(parsed.devices).toHaveLength(2)
        expect(parsed.devices[0].xyz).toEqual([2.5, 2.0, 2.0])
        expect(parsed.devices[0].quantity).toBe('TEMPERATURE')
        expect(parsed.devices[0].id).toBe('temp_1')
    })

    it('does not pick PBX/other tokens as XB', () => {
        const p = parseFdsGeometry("&SLCF PBX=2.5, QUANTITY='TEMPERATURE' /")
        expect(p.obsts).toHaveLength(0)
        expect(p.meshes).toHaveLength(0)
    })

    it('returns empty buckets for empty / non-string input', () => {
        expect(parseFdsGeometry('')).toMatchObject({ meshes: [], obsts: [], devices: [] })
        expect(parseFdsGeometry(null)).toMatchObject({ meshes: [], obsts: [] })
        expect(parseFdsGeometry(undefined).bounds).toBeNull()
    })
})

describe('computeBounds', () => {
    it('uses the mesh domain when meshes are present', () => {
        const parsed = parseFdsGeometry(SAMPLE)
        expect(parsed.bounds.min).toEqual([0, 0, 0])
        expect(parsed.bounds.max).toEqual([5, 4, 3])
        expect(parsed.bounds.center).toEqual([2.5, 2, 1.5])
        expect(parsed.bounds.size).toEqual([5, 4, 3])
    })

    it('falls back to obstruction/device extents with no mesh', () => {
        const parsed = parseFdsGeometry("&OBST XB=1,2,1,2,0,3 / &DEVC XYZ=5,5,5,QUANTITY='T' /")
        const b = computeBounds(parsed)
        expect(b.min).toEqual([1, 1, 0])
        expect(b.max).toEqual([5, 5, 5])
    })

    it('returns null when there is no geometry', () => {
        expect(computeBounds(parseFdsGeometry('&TAIL /'))).toBeNull()
    })
})

describe('summarizeFds', () => {
    it('counts each geometry kind', () => {
        expect(summarizeFds(parseFdsGeometry(SAMPLE))).toEqual({
            meshes: 1, obsts: 2, vents: 1, holes: 1, devices: 2,
        })
    })
})
