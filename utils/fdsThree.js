// Shared FDS -> three.js orientation, used by the 3D renderer (Scene3D) and the
// orientation regression test (__tests__/scene3d-orientation.test.js) so the two
// can never drift.
//
// Convention follows the fds-viewer reference (github.com/ProfRino/fds-viewer):
//     FDS (x, y, z)  ->  three (x, z, y)
// i.e. FDS Y -> three Z, FDS Z (up) -> three Y (three's up axis). Swap Y/Z, NO
// negation. Under the top-down camera below this reads on screen as +x RIGHT and
// +y DOWN — matching the 2D canvas the user draws on (which is also +y down) and
// matching how fds-viewer lays FDS geometry out. Do not negate Y "to make it
// north-up": that flips it relative to both the 2D canvas and the reference.
export const toThree = (x, y, z) => [x, z, y]

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
