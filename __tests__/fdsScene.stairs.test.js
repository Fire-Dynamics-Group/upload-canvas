import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseFdsGeometry } from '../utils/fdsParse'
import { buildFdsScene } from '../utils/fdsScene'

// The backend (backendForNextApp/stairs_fds.py setup_landings) emits the
// staircase as plain OBST boxes: LANDING / HALFLANDING / STEP1 (floor->half
// landing) / STEP2 (half landing->next floor). The 3D view has NO stair-aware
// code — it just renders whatever boxes the FDS carries. So "is the steps/
// landings algo correctly followed in 3D?" reduces to: does parse -> scene
// reproduce those boxes faithfully, and do the steps form a real ascending
// staircase between each landing pair?
//
// Fixture is real backend output:
//   .venv/Scripts/python -c "from mockData import stairElements; from fds import
//   testFunction; open('../upload-canvas/docs/reference-stairs-backend.fds','w')
//   .write(testFunction(stairElements, z=10, wall_height=3, wall_thickness=0.2,
//   stair_height=30, px_per_m=33.6, fire_floor=3, total_floors=6,
//   stair_enclosure_roof_z=35))"
// fire_floor=3, total_floors=6 -> 7 landings, 6 half landings, 6 flights x 8.
const text = readFileSync(join(__dirname, '..', 'docs', 'reference-stairs-backend.fds'), 'utf-8')
const parsed = parseFdsGeometry(text)
const scene = buildFdsScene(parsed)

const byLabel = (label) => scene.items.filter((i) => i.category === 'obst' && i.label === label)
// FDS line count for a given OBST ID — the ground truth the scene must match.
const fdsCount = (id) => (text.match(new RegExp(`ID='${id}'`, 'g')) || []).length

describe('backend stairs -> 3D scene pipeline', () => {
    it('renders one box per stair OBST (no dropped/duplicated geometry)', () => {
        for (const id of ['LANDING', 'HALFLANDING', 'STEP1', 'STEP2']) {
            expect(byLabel(id).length, id).toBe(fdsCount(id))
        }
    })

    it('matches the expected landing/flight count for fire_floor=3, total_floors=6', () => {
        expect(byLabel('LANDING').length).toBe(7)
        expect(byLabel('HALFLANDING').length).toBe(6)
        expect(byLabel('STEP1').length).toBe(48) // 6 flights x 8 steps
        expect(byLabel('STEP2').length).toBe(48)
    })

    it('gives every step a positive riser height (z extent)', () => {
        for (const s of [...byLabel('STEP1'), ...byLabel('STEP2')]) {
            expect(s.size[2]).toBeGreaterThan(0)
        }
    })

    it('every step has a real footprint in both horizontal axes', () => {
        // A zero-thickness tread (x1==x2 or y1==y2) renders as a 0.02 m sliver — a
        // sign the backend emitted a degenerate step. setup_landings used to
        // collapse the bottom tread of each STEP2 flight onto the half-landing
        // edge (its `step_num == 0` override set one y-edge to halflanding_y while
        // the per-step list had already pinned the other there). Fixed to span the
        // full source half landing, mirroring STEP1's bottom step.
        const degenerate = [...byLabel('STEP1'), ...byLabel('STEP2')].filter(
            (s) => s.size[0] <= 0.02 || s.size[1] <= 0.02,
        )
        expect(degenerate.map((s) => s.center)).toEqual([])
    })

    it('STEP1 treads ascend monotonically in z within each flight', () => {
        // Steps are emitted in order, 8 per flight. Their box-centre z must
        // strictly increase so the staircase climbs floor -> half landing.
        const steps = byLabel('STEP1')
        for (let f = 0; f < steps.length / 8; f++) {
            const flight = steps.slice(f * 8, f * 8 + 8).map((s) => s.center[2])
            for (let i = 1; i < flight.length; i++) {
                expect(flight[i], `flight ${f} step ${i}`).toBeGreaterThan(flight[i - 1])
            }
        }
    })

    it('keeps the staircase inside the mesh domain bounds', () => {
        const { min, max } = scene.bounds
        for (const s of [...byLabel('STEP1'), ...byLabel('STEP2'), ...byLabel('LANDING')]) {
            for (let a = 0; a < 3; a++) {
                const lo = s.center[a] - s.size[a] / 2
                const hi = s.center[a] + s.size[a] / 2
                expect(hi).toBeGreaterThanOrEqual(min[a] - 1e-6)
                expect(lo).toBeLessThanOrEqual(max[a] + 1e-6)
            }
        }
    })
})
