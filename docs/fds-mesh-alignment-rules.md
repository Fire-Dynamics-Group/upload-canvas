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

- **Snap-to-mesh-edge**: When drawing a new mesh near an existing one, the edge snaps to the existing mesh's edge within a 15px threshold. Magenta guide lines show when snapping is active.
- **Grid snap fallback**: If no mesh edge is nearby, vertices snap to the pixelsPerMesh grid (0.1m equivalent).

### Backend (fds.py)

- **`align_meshes()`**: Runs after coordinate conversion, before FDS line generation. Implements a wiggle-loop algorithm (ported from the original EXE's `prep_mesh_data`):
  1. Stair meshes are processed first (they anchor the alignment).
  2. For each pair of meshes that overlap in one axis, checks if any side is within the wiggle tolerance of the other mesh's side.
  3. Snaps both sides to `round(average / cell_size) * cell_size`, using the coarser cell size at stair interfaces.
  4. Tracks coarse-grid locks: once a boundary is snapped at a stair interface (0.2m grid), all subsequent meshes snapping to that boundary inherit the 0.2m grid.
  5. Increases wiggle tolerance (starting 0.22m, +0.05m per iteration) until all meshes touch at least one other mesh.

- **`create_stair_meshes()`**: Uses aligned coordinates directly from `align_meshes()` output rather than re-rounding.

- **`create_extract_shaft()`**: Snaps shaft boundaries to nearest mesh boundaries within 0.5m tolerance, eliminating gaps between shafts and corridor meshes.

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
