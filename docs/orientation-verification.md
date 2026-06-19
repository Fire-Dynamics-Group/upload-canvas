# FDS coordinate convention (2D → FDS → 3D)

## The convention — how a human reads the page

FDS coordinates are always the plain, human view of the drawing:

> **+x → RIGHT, +y → TOP of the screen, +z → OUT of the page (toward you).**

Standard right-handed, north at the top. The `.fds` file, the 2D plan, and the
3D top-down view all obey this. That's the whole goal — everything below is just
the plumbing needed to actually hit it.

This has **nothing to do with** the y-down pixel coordinates the drawing library
or three.js use internally. Those are tool quirks handled by two adapter steps
(R1 and R3); after them, everything speaks the human convention above. If the 3D
ever looks mirrored or rotated vs the plan, a violation of R1–R6 is why — check
them in order.

## The four coordinate spaces

| Space | Units / origin | +x | +y | +z |
|-------|----------------|----|----|----|
| **Canvas** (drawing input, Konva) | pixels, top-left | right | **DOWN** | — |
| **FDS world** (the `.fds` file) | metres | right / east | **UP / north** | up (height) |
| **three.js** scene | metres | right | up (three's up axis) | — |
| **Screen** (top-down view) | — | right | top | out of page |

The canvas is the **only** y-down space. Everything downstream is y-up, so
exactly **one** Y-flip happens in the whole pipeline, at the canvas→FDS boundary
(R1). Do not add a second flip anywhere.

## The rules

**R1 — Canvas → FDS (backend, `fds.py` ~L1580–1589).** Make points
origin-relative, scale by `px_per_m`, then flip Y about the model's max-y:
`y_fds = max_y − y`. x passes through; z is height. ⟹ FDS is y-up: an element
drawn at the **top** of the plan gets the **largest** `y_fds`. **This flip is
required. Do not remove it and do not "fix" orientation by changing its sign** —
the 3D mapping (R3) is what adapts to the camera.

**R2 — FDS axis semantics.** FDS world is right-handed: +x right/east,
+y top/north, +z up/height. Every producer (stairs, sensors, doors, meshes)
emits geometry in this space *after* R1; every consumer assumes it.

**R3 — FDS → three.js (`utils/fdsThree.js`, the single source of truth).**
three is y-up, so swap Y↔Z and negate FDS-y:

> `toThree(x, y, z) = [x, z, -y]`

- FDS x → three x (right)
- FDS z (up) → three y (three's up axis) → reads as "out of the page"
- FDS y (north) → three **−z** → reads as the **TOP** of the screen

The negation is what puts north at the top under R4's camera (+three-z projects
toward the **bottom**, so north must map to −three-z). Drop it and the model
mirrors north↔south vs the plan.

**R4 — Top-down camera (`topDownPlacement`, same file).** Eye above the target
along +three-y with a small +three-z offset (a dead-vertical view + world-up
locks OrbitControls at the gimbal pole), up = +three-y. Under this camera R3
yields the target exactly: +x right, +FDS-y top, +FDS-z toward the viewer.

**R5 — One mapping, shared.** `Scene3D` and the orientation test both import
`toThree`/`topDownPlacement`. Nothing recomputes axes inline.

**R6 — What the test must assert.** The orientation test must drive the **whole
chain** — canvas point → R1 (`y_fds = max_y − y`) → R3 → R4 camera → screen — and
assert *screen* positions. It must **not** assert `toThree`'s tuple against the
mapping it's testing (that is tautological and was how the N↔S mirror passed CI
unnoticed). Required invariants:

- **canvas-top → screen-top** (the N–S check that actually catches mirroring)
- canvas-right → screen-right
- FDS +z → three +y and toward the viewer

## How to verify

- **Automated:** `npx vitest run __tests__/scene3d-orientation.test.js` — models
  the backend transform and projects canvas points through `toThree` + the real
  camera. Proven non-tautological: it fails on `[x,z,y]` and passes on `[x,z,-y]`.
- **By eye:** open a project in 2D and in 3D → **Top**. A landmark (the fire, or
  one door) must sit on the **same side and same top/bottom** in both.

## History / why this doc was rewritten

An earlier version (and commit `55b4408`) chased **fds-viewer parity**
(`[x,z,y]`, no negation) and asserted "+y is down, same as the canvas." That was
wrong: our backend already flips Y (R1), so FDS-y is the **opposite** of canvas-y.
Rendering FDS-y downward therefore mirrored the model north↔south vs the drawn
plan, and the self-referential test never caught it. fds-viewer is a useful
*structural* cross-check, but it is **not** the orientation goal — matching the
user's drawing (north at top) is. We negate Y relative to fds-viewer on purpose.

## References

- **fds-viewer** — https://github.com/ProfRino/fds-viewer — structural FDS→3D
  reference only; its raw `(x,z,y)` mapping is **not** our orientation target
  (see History above).
