# FDS Mesh Alignment Rules

Rules for valid mesh configurations in Fire Dynamics Simulator, sourced from the NIST FDS User Guide, PyroSim documentation, Wikibooks, and fds-smv forum guidance.

## Core Rules

### 1. No Gaps Between Abutting Meshes

FDS does not simulate in uncovered space. Even a 1mm gap between two meshes means obstructions, devices, and flow data in that strip are invisible to the solver. Abutting mesh faces must share the exact same coordinate.

### 2. Cell Size Ratios Must Be Integer

Where two meshes share a face, the cross-sectional cell areas must have integer ratios: 1:1, 2:1, 3:1, etc. Non-integer ratios (e.g. 1.5:1) cause an error at startup.

### 3. Odd IJK + 2:1 Ratio = Failure

If a fine mesh has an odd number of cells along the interface axis (e.g. IJK=125 in X) and the coarse mesh is 2:1, the midpoint coarse cell straddles two fine cells. FDS cannot resolve this. Use even IJK values when 2:1 ratios are involved.

### 4. Overlapping Meshes: Priority by Order

Overlapping meshes are allowed. The mesh listed first in the FDS file (or with finer resolution) takes priority in the overlap region. Cell ratio rules still apply at overlap boundaries.

### 5. Boundaries on Cell-Size Multiples

Mesh boundaries (XB values) should fall on multiples of the cell size. For a 0.1m cell mesh, boundaries should be on 0.1m increments (e.g. 5.3, not 5.27). For 0.2m stair meshes, boundaries at stair interfaces should be on 0.2m increments.

### 6. Obstructions Must Be Visible to Both Meshes

An obstruction sitting exactly on a mesh boundary must be within both meshes to be "seen" by both. If it's 1mm outside a mesh's domain, that mesh treats it as nonexistent. Place mesh boundaries away from critical obstructions, or ensure the obstruction geometry overlaps into both meshes.

### 7. Avoid Boundaries at Fire/Critical Phenomena

Inter-mesh data exchange is less accurate than intra-mesh computation. Don't place mesh boundaries through the fire source, plume, or other regions where high accuracy is needed.

### 8. Order Meshes Finest to Coarsest

List finer meshes before coarser ones in the FDS file. This ensures the fine mesh takes priority in any overlap region.

## Cell Size Conventions (Common Corridor Simulations)

| Mesh Type | Cell Size | Grid Snap |
|-----------|-----------|-----------|
| Corridor / Lobby | 0.1m | 0.1m |
| Apartment | 0.1m | 0.1m |
| Stair (fire floor) | 0.1m | 0.1m |
| Stair (above/below fire) | 0.2m | 0.2m |
| Extract shaft | 0.2m | 0.2m |

When a 0.1m mesh abuts a 0.2m mesh, the interface coordinate must be on a 0.2m multiple (the coarser grid governs the shared face). This gives a valid 2:1 cell ratio.

## How the Web App Enforces This

### Frontend (Canvas.jsx)

#### Mesh-to-mesh alignment (isolated)

- **Meshes align only to other meshes. Full stop.** Mesh rect drawing uses `snapVertexWithMeshPriority` → `snapToMeshEdges` → `collectMeshEdgeCoordinates`. The candidate source is strictly `isMesh(el)` elements. Walls, stair landings, sensors, and other non-mesh elements are invisible to mesh-drawing snap.
- **Why the isolation matters.** Mesh alignment is tied to the integer cell-ratio and cell-size-multiple rules above — it has to be tight and deterministic. Letting meshes snap to arbitrary element edges would pull them off cell boundaries and produce invalid `align_meshes()` input. This is a deliberate hard rule, not a convenience default.
- **Threshold and visual.** 15 px screen threshold, magenta dashed full-canvas guide line.
- **Grid fallback.** If no mesh edge is within threshold on an axis, that axis falls back to `pixelsPerMesh` grid (0.1 m equivalent).

#### Everything-else alignment (waterfall)

Applied to polylines (walls, doors, inlets, extracts), single points (sensors, devices), and **non-mesh rects** (stair landings, stair obstructions, sensor boxes). Implemented via `snapVertexWithPointPriority` → `collectPointAlignmentCoordinates`.

Waterfall in priority order:

1. **Point snap** — nearest existing vertex within threshold wins. Sources: every polyline vertex, every point element, every rect's 4 corners (mesh AND non-mesh), and the in-progress drawing points (`currentPoly` / `currentRect[0]`) so the next click aligns to the previous one of the same element.
2. **Alignment extension** — if no point wins on an axis, the nearest X/Y coordinate from the candidate set snaps the cursor on that axis independently (H and Y handled separately so a cursor can snap to point A's X and point B's Y simultaneously).
3. **Grid fallback** — any axis not snapped above quantizes to the `pixelsPerMesh` grid.

User overrides:

- **Shift held** during the action suppresses the alignment layer entirely: goes straight to grid snap. Use this to place a point near an existing edge without magnetising to it.
- The waterfall does not require flushness — if the cursor is outside the 15 px threshold from any candidate, the element lands on the nearest grid cell. Users can therefore draw near but not on existing elements without fighting the snap.

#### Summary: which source sees what

| Drawing tool / element | Sees mesh edges? | Sees walls / points / non-mesh rects? | Sees in-progress points? | Grid fallback? | Shift override? |
|---|---|---|---|---|---|
| Mesh rect | ✓ | ✗ (deliberately isolated) | ✗ | ✓ | ✓ (opt-in escape: grid-only, use when mesh is not meant to abut another edge) |
| Wall polyline | ✓ (mesh corners) | ✓ | ✓ (`currentPoly`) | ✓ | ✓ |
| Door / inlet / extract (2-point polyline) | ✓ | ✓ | ✓ (`currentPoly`) | ✓ | ✓ |
| Single point (sensor, device) | ✓ | ✓ | — | ✓ | ✓ |
| Non-mesh rect (stair landing, stair obstruction, sensor box) | ✓ | ✓ | ✓ (`currentRect[0]`) | ✓ | ✓ |

The only row with an asymmetric "✗" is mesh drawing. All other rows use the same waterfall; they differ only in whether an in-progress-points state exists and what it's called.

### Backend (fds.py)

> **Important:** the live backend does **not** perform any mesh-to-mesh
> alignment. Each mesh's coordinates are rounded to the grid *independently* —
> there is no pairwise wiggle-loop. Abutment between two meshes is achieved
> *only* because the frontend snap placed them on coincident coordinates that
> then round to the same value. The backend adds no safety net: if two meshes
> don't already abut (e.g. the user held Shift to suppress the frontend snap),
> the FDS output will contain a gap or overlap, silently.

The actual mesh pipeline in `generate_fds()`:

1. **`returnOrigin()` → `makeElementsRelativeToOrigin()`**: find the bottom-left
   point and shift all element coordinates relative to it.
2. **`convertElPointsToCoords(elements, px_per_m)`**: convert pixels → metres.
3. **`create_mesh()` → `create_fds_mesh_lines()`** (regular meshes): each mesh's
   own X/Y corners are rounded to 0.1 m **independently** (`round(x1, 1)` etc.).
   `IJK = round(delta / cell_size)`. No reference to any other mesh.
4. **`create_stair_meshes()`**: X/Y corners rounded to 0.1 m independently; Z
   boundaries snapped to 0.2 m via `snap_to_grid()`. Splits each stair mesh into
   Lower (0.2 m) / Middle/fire-floor (0.1 m) / Upper (0.2 m) sub-meshes.

There is **no `align_meshes()`, no `create_extract_shaft()` snapping, and no
wiggle-loop** in the current `fds.py`. The wiggle-loop algorithm described in
old versions of this doc exists only in the original EXE
(`helper_functions.py` `prep_mesh_data()`) and was **never ported** to this
backend. If that behaviour is ever needed, it would have to be added here.

Known gap (not yet fixed): `create_stair_meshes()` rounds stair X/Y to 0.1 m,
not 0.2 m, so a stair boundary can land on an odd 0.1 m multiple — at odds with
rules 3 and 5 above. Tracked for a fix-if-it-bites-in-practice basis.

## Validation

Run FDS with these two lines added to the input file to check alignment without running the full simulation:

```
&MISC CHECK_MESH_ALIGNMENT=T /
&TIME T_END=0 /
```

If FDS exits without error, the mesh configuration is valid.

## References

- NIST FDS User Guide, Chapter 6: "Multiple Meshes"
- PyroSim User Manual: "Snap to Model Grids"
- FDS-SMV Discussion Forum: mesh alignment threads
- Original EXE source: `helper_functions.py` `prep_mesh_data()`, `geometry_to_dataframes.py` `setup_meshes()`
