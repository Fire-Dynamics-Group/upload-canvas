# 3D / 2D / FDS orientation — how it should look

The 3D view verifies the FDS geometry. Its orientation must match two things: the
**fds-viewer reference** and the **2D canvas** the user draws on. This note is the
high-level rule for checking that.

## The rule

> **FDS (x,y,z) → three (x, z, y)** — swap Y/Z for three.js's Y-up, **no
> negation** (the fds-viewer convention). Under the top-down camera this reads
> **+x → RIGHT (east), +y → DOWN, +z → OUT of the screen** (up/height).

`+y` is **down** on screen — the same as the 2D canvas, which draws points raw
(no Y-flip), so larger y is lower. Don't "correct" it to north-up by negating Y:
that flips the 3D relative to both the 2D plan and fds-viewer.

Trace a landmark — the fire, or one door — across the 2D plan and the 3D
top-down. It must sit on the **same side and same height** in both.

## Where it lives

- **Mapping:** `utils/fdsThree.js` (`toThree`) — `[x, z, y]`, shared by the
  renderer and the test so they can't drift. Matches fds-viewer's
  "FDS Y→three Z, FDS Z→three Y".
- **Camera:** `topDownPlacement` (same file) — a steep bird's-eye, not
  dead-vertical (straight-down + world-up locks OrbitControls at the gimbal
  pole). The tilt only adds perspective; it doesn't change which side is which.

## How to verify

- **Automated (in the suite):**
  `npx vitest run __tests__/scene3d-orientation.test.js` — asserts the mapping
  equals the fds-viewer `(x, z, y)` and that the projected screen directions
  follow (+x right, +y down, +z out-of-screen, viewed from above). If anyone
  negates an axis or swaps the mapping, it fails.
- **By eye:** open a project in 2D and in 3D → **Top**; the fire and a door must
  land on the same side and height in both.
- **Picture:** `orientation-compare.{html,png}` (repo root) renders a reference
  building's plan next to the 3D bird's-eye for a quick sanity look.

## References

- **fds-viewer** — https://github.com/ProfRino/fds-viewer — the FDS → 3D viewer
  we align to. Its mapping (`js/viewer.js`: `Vector3(minX, minZ, minY)`,
  `position.set(o[0], o[2], o[1])`) is the source of the `(x, z, y)` convention.

## Caveat — the backend's Y direction

This keeps the 3D consistent with fds-viewer and the 2D canvas. Whether a given
project's 2D and 3D agree top/bottom ultimately depends on how the backend maps
drawing pixels → FDS metres in Y (it lives in the FastAPI service, not this repo).
If they ever disagree, fix the **backend's pixel→metre Y sign**, not this mapping.
