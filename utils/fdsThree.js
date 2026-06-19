// Shared FDS -> three.js orientation, used by the 3D renderer (Scene3D) and the
// orientation regression test (__tests__/scene3d-orientation.test.js) so the two
// can never drift.
//
//     FDS (x, y, z)  ->  three (x, z, -y)
//
// Target, on screen in the top-down view: +x RIGHT, +y TOP, +z OUT of the page.
// FDS world is right-handed and y-UP: +x east/right, +y north/top, +z up/height
// (the backend establishes this by flipping the y-down drawing canvas once, in
// fds.py: `y_fds = max_y - y_canvas`). To present that under a top-down camera:
//   FDS x -> three x        (right)
//   FDS z (up)   -> three y (three's up axis) -> reads as "out of the page"
//   FDS y (north)-> three -z -> reads as the TOP of the screen
// The negation on y is what puts north at the top under topDownPlacement's camera
// (+three-z projects toward the BOTTOM, so north must map to -three-z). Drop it
// and the model mirrors north<->south vs the plan. This is the single source of
// orientation truth — do not recompute axes inline anywhere else.
export const toThree = (x, y, z) => [x, z, -y]

// Top-down (steep bird's-eye) camera placement for FDS `bounds` ({center,size}).
// Kept off straight-down on purpose: a dead-vertical view with world-up hits the
// OrbitControls gimbal pole and locks rotation. The slight tilt stays orbitable
// while reading as a plan. Returns three-space eye/target/up.
export function topDownPlacement(bounds) {
    const c = bounds ? bounds.center : [0, 0, 0]
    const [cx, cy, cz] = toThree(c[0], c[1], c[2])
    const d = bounds ? Math.max(bounds.size[0], bounds.size[1], bounds.size[2], 4) : 12
    return {
        up: [0, 1, 0],
        target: [cx, cy, cz],
        eye: [cx, cy + d * 1.7, cz + d * 0.55],
    }
}
