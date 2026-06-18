import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { toThree, topDownPlacement } from '../utils/fdsThree'

// Orientation must match BOTH the fds-viewer reference and the 2D canvas.
//
// fds-viewer (github.com/ProfRino/fds-viewer) maps FDS (x,y,z) -> three (x,z,y)
// — "FDS Y→three Z, FDS Z→three Y", no negation. Under our top-down camera that
// reads on screen as:
//     +x (east)  -> RIGHT
//     +y (north) -> DOWN   (same as the raw, y-down 2D canvas the user draws on)
//     +z (up)    -> OUT of the screen, toward the viewer
// We verify the mapping equals the reference, and that the projected screen
// directions follow. Deterministic: no WebGL, no backend.

const BOUNDS = { center: [0, 0, 0], size: [20, 20, 10] }

function makeCamera() {
    const cam = new THREE.PerspectiveCamera(50, 800 / 600, 0.05, 5000)
    const { up, target, eye } = topDownPlacement(BOUNDS)
    cam.up.set(up[0], up[1], up[2])
    cam.position.set(eye[0], eye[1], eye[2])
    cam.lookAt(new THREE.Vector3(target[0], target[1], target[2]))
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()
    return cam
}
function ndc(cam, [x, y, z]) {
    const v = new THREE.Vector3(...toThree(x, y, z)).project(cam)
    return { x: v.x, y: v.y, z: v.z }
}

describe('FDS -> 3D orientation matches fds-viewer and the 2D canvas', () => {
    it('uses the fds-viewer mapping: FDS (x,y,z) -> three (x, z, y)', () => {
        // FDS Y -> three Z, FDS Z -> three Y, no negation.
        expect(toThree(1, 2, 3)).toEqual([1, 3, 2])
        expect(toThree(-4, 5, -6)).toEqual([-4, -6, 5])
    })

    const cam = makeCamera()

    it('+x (east) is to the RIGHT', () => {
        expect(ndc(cam, [6, 0, 0]).x).toBeGreaterThan(ndc(cam, [-6, 0, 0]).x)
    })

    it('+y (north) is DOWNWARD on screen — same as the y-down 2D canvas', () => {
        // NDC y is up-positive, so "lower on screen" = smaller NDC y.
        expect(ndc(cam, [0, 6, 0]).y).toBeLessThan(ndc(cam, [0, -6, 0]).y)
    })

    it('+z (up) comes OUT of the screen, toward the viewer', () => {
        const { eye } = topDownPlacement(BOUNDS)
        const e = new THREE.Vector3(eye[0], eye[1], eye[2])
        expect(e.distanceTo(new THREE.Vector3(...toThree(0, 0, 4))))
            .toBeLessThan(e.distanceTo(new THREE.Vector3(...toThree(0, 0, -4))))
        expect(ndc(cam, [0, 0, 4]).z).toBeLessThan(ndc(cam, [0, 0, -4]).z)
    })

    it('views the model from above (camera higher than the geometry)', () => {
        const { eye, target } = topDownPlacement(BOUNDS)
        expect(eye[1]).toBeGreaterThan(target[1]) // three Y is up
    })
})
