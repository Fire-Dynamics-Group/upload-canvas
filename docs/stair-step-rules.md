# STEP1 / STEP2 generation rules (side elevation)

How `setup_landings` (backendForNextApp/stairs_fds.py, default `overlapping` style)
turns a landing pair into a flight. Numbers in brackets are from
`docs/reference-stairs-backend.fds` flight 0 (z_floor=0, z_half=1.665, z_next=3.33).

## The two platforms a flight bridges

Every flight climbs from a **source** platform to a **destination** platform one
half-storey above:

| flight | source        | destination       |
| ------ | ------------- | ----------------- |
| STEP1  | floor landing | half landing      |
| STEP2  | half landing  | next floor landing|

`num_steps = 8`.

## Side elevation profile

```
                          ____  z_dest   ← step 7 top flush with destination platform
                      ___|
                  ___|
              ___|
          ___|
      ___|
   __|                    z_src   ← step 0 top flush with source platform
  |
 source platform     gap (run)     destination platform
```

Each step is one OBST box: a tread footprint (run × width) with a box height of
exactly one riser.

## Rule 1 — Z: bridge the vertical gap (riser)

`h = (z_dest - z_src) / (num_steps - 1)`  → 7 risers spanning 8 treads  [h = 0.238]

For step `n` (0..7):
- `z_top = z_src + n*h`, `z_bottom = z_top - h`
- **clamp step 0**: `z_top = z_src` (bottom tread flush with source; box dips below it — buried)
- **clamp step 7**: `z_top = z_dest` (top tread flush with destination)

⇒ tread tops land exactly on `z_src, z_src+h, …, z_dest`.
[step 0: z -0.238→0.0; step 7: z 1.427→1.665]

## Rule 2 — X/Y: extend across the gap (going/run)

The horizontal axis with the larger landing-to-landing offset is the **run**
(`stair_direction`); the other axis is the **width**.

**Run** — tread going `g = ceil(100 * gap / (num_steps - 1)) / 100`, where `gap`
is the distance between the two landings' **inner (facing) edges**. Tread `n` is
offset by `g` per step, marching source → destination.
- **step 0 extends fully back over the SOURCE platform footprint** (first tread
  sits on the landing, no gap). [STEP1 step0 y 5.957→7.472 = full floor landing;
  STEP2 step0 y 2.12→3.13 = full half landing]
- **step 7 overlaps onto the DESTINATION platform.**

**Width** — constant for the whole flight, equal to the shared half of the shaft.
STEP1 takes one half, STEP2 the complementary half → switchback (dog-leg).
[STEP1 x 5.25→6.664; STEP2 x 6.664→8.078]

## Invariants (what the 3D pipeline test should hold)

- 8 STEP1 + 8 STEP2 per flight; one box each, none dropped/duplicated.
- every step has positive z extent (riser) and a real footprint in both
  horizontal axes (no zero-thickness slivers).
- STEP1 tread tops ascend monotonically z_src → z_dest; STEP2 likewise to z_next.
- step 0 of each flight spans its full source-platform footprint in the run axis.
- whole flight stays within the mesh domain bounds.

See `__tests__/fdsScene.stairs.test.js` for the executable form.
