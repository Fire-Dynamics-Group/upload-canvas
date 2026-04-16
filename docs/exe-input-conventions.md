# EXE input conventions

Facts about how the original Common Corridor FDS Gen EXE expects its input,
learned from behavioural comparison with the canvas port.

## Big-picture: the web app deliberately removes EXE user restrictions

The EXE relies on the Bluebeam operator to hand it clean input — closed
polygons with vertices in a specific order, minimal edges, exact orthogonal
coordinates. Those are **user-facing restrictions**: the operator has to know
to draw polygons a particular way.

**The web app is explicitly designed so the user has none of those
restrictions.** A user can:
- Draw wall segments in any order, from any direction.
- Start/stop lines anywhere — no requirement to close a polygon.
- Create T-junctions where one wall lands on the middle of another.
- Leave minor sub-pixel drift in coordinates — line drawing snaps to
  orthogonal on the way in.

The app instead **derives the polygon from the space itself**: `findEnclosedRegions`
walks the wall-edge graph and emits each enclosed face's vertices in perimeter
traversal order. No user input about vertex order is needed; winding is an
algorithmic property of the face walk, not something the user controls.

**Implication for anyone touching sensor / centerline code:** do not assume
the polygon handed to `computeCenterlinePoints` matches EXE-style input.
Specifically, it will routinely have:

- Extra vertices at T-junctions where another wall meets mid-edge (collinear
  with their neighbours).
- No closing duplicate vertex (face walk emits each node once).
- A winding order determined by the face-walk algorithm, not by the user.

Any logic ported from the EXE that depends on EXE-style input shape (Monte
Carlo's consecutive-vertex rectangle picking, the 4-point slicing shortcut,
`sortVerticesIntoWindingOrder`) must either be preceded by a normalisation
step that cleans the zone polygon, or replaced with logic that tolerates the
above. **Do not push cleanup burden onto the user.**

## Polygon vertex winding (EXE)

- **EXE expects polygon vertices in clockwise order.**
- `getBestRectangles` in the EXE relies on iterating through three
  consecutive vertices in source order to pick sub-rectangles. The Monte
  Carlo decomposition only closes cleanly when the winding is consistent CW —
  reverse order can yield empty rectangle sets or wrong sub-divisions, which
  in turn produces 0 sensors or a grid pattern instead of a centerline.
- This is a constraint on EXE input only. The canvas's zone polygons emerge
  from `findEnclosedRegions` in a consistent algorithm-determined order that
  may or may not be CW — but because decomposition is preceded (or should
  be preceded) by a collinear-merge normalisation, absolute winding is not
  load-bearing in the canvas path.

## Downstream effects of wrong winding (EXE path only)

- Simple rectangular rooms: slicing picks the wrong axis, producing many thin
  strips and a grid of sensors rather than a single centerline.
- T-shape / L-shape rooms: Monte Carlo never closes → `getBestRectangles`
  returns `[]` → zero sensors placed.

## Required normalisation for the canvas zone path

Zone polygons from `findEnclosedRegions` need two things before being fed to
`getBestRectangles`:

1. **Collinear-vertex merge.** Walk the perimeter-ordered vertices and drop
   any vertex whose incoming and outgoing edges are parallel. This removes
   T-junction extras that Monte Carlo would otherwise pick as false rectangle
   corners and use to split a rectangular lobby into sub-rects.
2. **Closing-duplicate vertex append.** So decomposition takes the Monte
   Carlo path rather than the 4-point slicing shortcut (which slices any
   perfect rectangle into a 1m-column grid regardless of winding).

With those two steps, `sortVerticesIntoWindingOrder` becomes redundant on the
zone path — the polygon is already in perimeter order from the face walk.
