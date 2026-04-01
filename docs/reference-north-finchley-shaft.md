# Reference: Mechanical Extract Shaft — EXE + Pyrosim Examples

> **This file is a READ-ONLY reference.** It documents how the Common Corridor FDS Gen EXE and subsequent manual Pyrosim work produce FDS for mechanical extract shafts across two real projects. We are NOT looking to modify or improve these files. They exist purely as context for improving the upload-canvas web app's `create_extract_shaft()` function.

## Sources

### North Finchley (0406) — FS2 Plot 84 FSA
- **File:** `reference-FS2_Plot84_FSA_WIP.fds` (copy kept alongside this doc)
- **Origin:** Base FDS from EXE, manually completed in Pyrosim 2026.1.211 (26 Mar 2026)
- **Also stored in:** `C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\03 Modelling Data\0406 - Former Homebase Site North Finchley\FS2_Plot84_FSA\`

### Crown Wharf (65) — Block A2, FS11
- **File:** `reference-FS11_A2_1_092_MLNL_NCC.fds` (copy kept alongside this doc)
- **Origin:** Base FDS from EXE, manually completed in Pyrosim. ~60% EXE-generated, ~40% manual.
- **Also stored in:** `C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\03 Modelling Data\65. Crown Wharf\Run 06 - Block A2_1MechLobby_1Nat_NewScenario\`

## What the EXE Actually Does (Source Code)

The EXE source is at: `C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\05 R&D\11 IS\Common Corridor FDS Gen\populate_fds_file\`

### The EXE does NOT create a shaft mesh

`setup_meshes()` in `geometry_to_dataframes.py:528` only creates meshes for three categories: `['Apartment', 'Corridor', 'Stair']`. There is no extract/shaft mesh category.

### Extract is a flat VENT on the corridor wall

`extract_fds_line()` in `populate_fds_file.py:486` creates a single 2D `&VENT` with `SURF_ID='Extract'` placed against the corridor wall face. Key logic:

- It reads the `Mech_extract_side` element (a line drawn on the corridor wall in the CSV)
- Determines orientation (horizontal vs vertical opening)
- Offsets by `wall_thickness` depending on draw direction to place the vent on the **inside face** of the corridor wall
- The vent is at a user-specified height (`vent_base` to `vent_base + vent_height` above floor)
- Output: `&VENT ID='Mech Extract 1', SURF_ID='Extract', XB=...`

**That's it.** No shaft mesh, no OPEN vent, no HOLE, no shaft walls. The EXE only produces a flat extract surface on the corridor wall.

### Extract SURF definition

`air_vent_surface()` in `populate_fds_file.py:216` creates the SURF:
```
&SURF ID='Extract', RGB=26,128,26, VOLUME_FLOW=3.0/
```
With optional ramping support via `RAMP_V`.

### Stair AOV is a HOLE (separate from extract)

`Stair_AOV()` in `controls.py:187` creates a `&HOLE` at the top of the stair enclosure (1m x 1m, centred between landings, at `stair_height +/- 0.4m`). This punches through the stair roof — the stair mesh's OPEN boundary at ZMAX handles venting. This is for the stair head, not the corridor extract.

## What Pyrosim Added Manually (Not from EXE)

The shaft mesh and its associated geometry in `reference-FS2_Plot84_FSA_WIP.fds` were **added manually in Pyrosim** after the EXE generated the base FDS. This includes:

### Shaft mesh
```
&MESH ID='MESH', IJK=5,12,124, XB=7.5,8.0,8.5,9.7,0.0,12.4
```
- 0.5m x 1.2m footprint, 12.4m tall
- 0.1m cells (matching corridor)
- Adjacent to Corridor_Mesh3 (XMIN 7.5 == corridor XMAX 7.5)

### Solid wall separation
```
&OBST ID='Corridor Walls', XB=7.4,7.5,6.1,9.7,3.1,5.5
```
- Corridor wall sits on the shared mesh boundary face
- This is the solid separation between corridor and shaft domains

### Extract at ZMAX (not corridor level)
```
&SURF ID='Extract', RGB=26,128,26, HEAT_TRANSFER_COEFFICIENT=0.0, VOLUME_FLOW=5.0/
&VENT ID='Mesh Vent: MESH [ZMAX]', SURF_ID='Extract', XB=7.5,8.0,8.5,9.7,12.4,12.4/
```
- Extract surface at the **top** of the shaft, not at the corridor interface
- No OPEN or extract vent at corridor level

### No corridor-level opening visible

The Pyrosim FDS does **not** have an explicit HOLE or OPEN vent connecting the corridor to the shaft at corridor level. The corridor wall obstruction runs the full height (`3.1 to 5.5`). This appears to be **incomplete** — there should be an opening (HOLE) in the corridor wall to allow smoke to enter the shaft from the corridor. This may have been left unfinished in the Pyrosim model.

## Crown Wharf — How the Completed Pyrosim Model Does It

Crown Wharf is the most complete reference. 19 meshes including a full-height mechanical extract shaft.

### Shaft mesh (adjacent to corridor, not overlapping)
```
&MESH ID='Extract Mesh', IJK=9,9,542, XB=26.8,27.7,6.4,7.3,-4.8,49.4
```
- 0.9m x 0.9m footprint, 54.2m tall (full building height including basement)
- 0.1m cells (matching corridor)
- Corridor_Mesh2-02: `XB=13.8,28.0,4.7,6.4,3.6,5.9`
- Shaft YMIN (6.4) == Corridor YMAX (6.4) — they **abut** at a shared face

### Corridor wall split into three sections at the shaft interface

The corridor wall at Y=6.3–6.4 is split where it meets the shaft (X=27.0–27.6):

```
&OBST ID='Corridor Walls', XB=27.0,27.6,6.3,6.4,3.6,4.5, SURF_ID='Plasterboard'/          ← below opening (fixed)
&OBST ID='Corridor Walls', XB=27.0,27.6,6.3,6.4,5.8,5.9, SURF_ID='Plasterboard'/          ← above opening (fixed)
&OBST ID='Corridor Walls', XB=27.0,27.6,6.3,6.4,4.5,5.8, SURF_ID='Plasterboard', CTRL_ID='invert'/  ← DAMPER (removable)
```

**No HOLE. No VENT at corridor level.** The corridor-shaft connection is a **controlled OBST (damper)** — a section of wall with `CTRL_ID='invert'` that gets removed when the control activates.

### Damper control
```
&CTRL ID='invert', FUNCTION_TYPE='ALL', LATCH=.FALSE., INITIAL_STATE=.TRUE., INPUT_ID='TIMER->OUT'/
&DEVC ID='TIMER->OUT', QUANTITY='TIME', XYZ=17.8,-3.3,3.6, SETPOINT=45.0/
```
- `INITIAL_STATE=.TRUE.` means the OBST starts present (damper closed)
- When TIMER fires at 45s, the control inverts → OBST removed → damper opens
- For FSA scenarios, the system is already running at t=0, so the damper OBST would either not be generated or use a setpoint of 0

### Extract SURF at ZMAX (fan at top of shaft)
```
&SURF ID='Extract', RGB=26,128,26, HEAT_TRANSFER_COEFFICIENT=0.0, VOLUME_FLOW=6.0, TAU_V=-10.0/
&VENT ID='Extract', SURF_ID='Extract', XB=26.8,27.7,6.4,7.3,49.4,49.4, DEVC_ID='TIMER->OUT'/
```
- Extract surface at the **top** of the shaft mesh (ZMAX=49.4)
- `TAU_V=-10.0` ramps the fan up over 10 seconds
- `DEVC_ID='TIMER->OUT'` activates the fan at 45s (same timer as the damper)
- For FSA (`always_open`), no DEVC_ID needed — fan runs from t=0

## Key Differences from Web App's Current Output

| Aspect | Crown Wharf (target) | Finchley (target) | EXE only | Web app (current) |
|--------|---------------------|-------------------|----------|-------------------|
| Shaft mesh | Adjacent, wall between | Adjacent, wall between | No shaft mesh | Overlapping corridor |
| Corridor interface | Controlled OBST damper | Wall (incomplete) | Flat extract VENT | OPEN vent on shared face |
| ZMAX vent | Extract SURF + DEVC | Extract SURF | N/A | OPEN vent |
| Solid separation | Wall split: below + above + damper | Full wall | Wall from obstructions | No wall |
| Cell size | 0.1m | 0.1m | N/A | 0.2m |

## What the Web App Should Do

Based on the Crown Wharf reference (most complete):

1. Create a shaft mesh **adjacent** to the corridor mesh (not overlapping), offset by wall thickness
2. **Split the corridor wall** at the extract opening into three pieces:
   - Fixed wall below the opening (floor to `opening_base`)
   - Fixed wall above the opening (`opening_base + opening_height` to ceiling)
   - **Controlled OBST (damper)** in the opening zone, with `CTRL_ID` for timed/sprinkler activation
   - For `always_open` (FSA): either omit the damper OBST entirely, or use a control that removes it at t=0
3. Place the **Extract SURF** at the shaft ZMAX with `HEAT_TRANSFER_COEFFICIENT=0.0`
4. Attach activation controls (`DEVC_ID`) to the ZMAX vent (same timer as damper)
5. Match cell size to corridor (0.1m)

## Feedback That Prompted This Reference

> "There's a mesh for the smoke shaft, but there's an extract surface at the corridor and an open surface at the head of the shaft mesh, along with an opening. Additionally, the shaft mesh boundary fully connects with the corridor mesh boundary. Looks like they overlap (so will fail anyway) but better they are adjacent and separated by solid obstructions."
