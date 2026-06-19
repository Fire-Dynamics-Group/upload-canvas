import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { toThree, topDownPlacement } from '../utils/fdsThree'

// The top-down 3D view must reproduce the 2D plan the user drew. That is an
// END-TO-END property across two coordinate systems, so this test models the
// whole chain — it does NOT just assert that toThree() returns some tuple.
//
//   2D canvas:  +x RIGHT, +y DOWN  (screen pixels; top of plan = small y)
//   backend:    emits FDS y-UP via  y_fds = maxY - y_canvas   (fds.py)
//               => FDS Y runs OPPOSITE to canvas Y
//   frontend:   toThree maps FDS -> three, then the top-down camera projects it
//
// Requirement: an element drawn HIGHER on the canvas must appear HIGHER on
// screen; an element drawn further RIGHT must appear further right. If toThree
// stops cancelling the backend's Y-flip, the N–S assertion below fails — which
// is exactly the mirror bug a pure "toThree === [x,z,y]" check missed.

const CANVAS_MAX_Y = 20 // arbitrary plan height in metres for the model

// Reproduce the backend's canvas->FDS transform (the part that matters for
// orientation: x passes through, y is flipped about the plan height).
const canvasToFds = ({ x, y }) => ({ x, y: CANVAS_MAX_Y - y, z: 0 })

const BOUNDS = { center: [10, 10, 5], size: [20, 20, 10] }

function makeCamera() {
    const cam = new THREE.PerspectiveCamera(50, 800 / 600, 0.05, 5000)
    const { up, target, eye } = topDownPlacement(BOUNDS)
    cam.up.set(...up)
    cam.position.set(...eye)
    cam.lookAt(new THREE.Vector3(...target))
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()
    return cam
}

// Project a CANVAS point all the way to normalized device coords, through the
// real backend transform + toThree + camera. NDC: x right-positive, y up-positive.
function projectCanvasPoint(cam, canvasPt) {
    const f = canvasToFds(canvasPt)
    const v = new THREE.Vector3(...toThree(f.x, f.y, f.z)).project(cam)
    return { x: v.x, y: v.y }
}

describe('3D top-down view reproduces the 2D plan orientation', () => {
    const cam = makeCamera()

    it('an element at the TOP of the canvas appears at the TOP of the 3D view', () => {
        const top = projectCanvasPoint(cam, { x: 10, y: 2 })     // small canvas-y = high on plan
        const bottom = projectCanvasPoint(cam, { x: 10, y: 18 })  // large canvas-y = low on plan
        // higher on screen = larger NDC y
        expect(top.y).toBeGreaterThan(bottom.y)
    })

    it('an element to the RIGHT on the canvas appears to the RIGHT in the 3D view', () => {
        const right = projectCanvasPoint(cam, { x: 18, y: 10 })
        const left = projectCanvasPoint(cam, { x: 2, y: 10 })
        expect(right.x).toBeGreaterThan(left.x)
    })

    it('maps FDS Z (up) to three Y (the up axis) and cancels the backend Y-flip', () => {
        // FDS Z -> three Y; FDS Y -> three Z negated. Guards the mapping shape so
        // Scene3D and this test can't silently diverge.
        expect(toThree(1, 2, 3)).toEqual([1, 3, -2])
        expect(toThree(-4, 5, -6)).toEqual([-4, -6, -5])
    })

    it('views the model from above (camera higher than the geometry)', () => {
        const { eye, target } = topDownPlacement(BOUNDS)
        expect(eye[1]).toBeGreaterThan(target[1]) // three Y is up
    })
})
