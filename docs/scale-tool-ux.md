# Scale-tool UX — shipped and deferred

Calibration UX for the Scale tool. Summarises what's wired up today and what's deliberately parked for later. Based on a cross-app survey of Bluebeam Revu, AutoCAD, Adobe Acrobat, SketchUp, Figma, tldraw, and Excalidraw.

## Shipped

- **Full-canvas crosshair** — cyan dashed horizontal + vertical lines through the pointer, active from the moment Scale is selected. Lets the user visually align click 1 to distant features on the plan. Bluebeam "Full-Screen Crosshair" + AutoCAD default cursor convention.
- **Live distance readout** — after click 1, a dashed cyan line runs from click 1 to the cursor with a `NNN px` label near the pointer. Every serious measure tool does this.
- **Ctrl-ortho** — Ctrl held during click 2 snaps to horizontal/vertical via `snapVertexOrtho`. Industry convention is Shift, not Ctrl (see deferred #1 below). **Fixed 2026-06:** the *committed* 2nd point used to ignore ortho (the click handler snapped against `currentPoly`, which is empty in scale mode) while the rubber-band line *showed* ortho — so the point landed away from the indicator. Now both the click and the hover crosshair ortho against `scalePoints[0]`, so crosshair, line, and landed point coincide.
- **Set scale tool button + re-entry** — `Set scale` is exposed in the Toolbar (not just auto-run on first upload), so a loaded project can be re-calibrated. Entering scale mode clears stale `scalePoints` so the `length < 2` guard doesn't block a second calibration.
- **Grid snap fallback** (pre-existing) — scale points quantise to `pixelsPerMesh` when no other snap is active. Scale happens before any elements exist so alignment candidates would be empty anyway.

Implementation lives in `Components/Canvas.jsx` — search for "Scale-tool crosshair" comment.

## Device independence + reset flow (planned 2026-06)

Motivated by: a loaded project ("0406 Finchley Ground Floor") came back with `pixelsPerMesh = 1`, so no grid (the grid is gated on `hasScale = pixelsPerMesh !== 1`). Root cause: the scale was `1` in the store at last save — the round-trip itself is correct. The deeper issue is that the scale is anchored to render pixels, which is fragile across devices/zoom. Cross-app survey (Bluebeam, Acrobat, PDF-XChange, Foxit, Qoppa) all converge on the same answer.

### The principle (how every measurement tool does it)

Scale is a **ratio, drawing-length : real-world-length, anchored to the document's intrinsic units (PDF points, 1/72")** — never to screen or render pixels. That's why a CAD→PDF export carries scale automatically and a measurement reads identically on any monitor or zoom. Calibrate by a known dimension (click-click + length + units); the stated title-block scale is treated as untrustworthy because export/print rescales it.

### What's wrong here today

- **Storage anchored to render pixels.** `pixelsPerMesh` = render-px-per-0.1 m at a hard-coded `1.5` render scale (`renderPdf`). Stable only because that `1.5` never changes. Adding the zoom/pan already TODO'd in `Gridlines.jsx`, or changing DPI, breaks every saved scale.
- **Pointer mapping uses raw `pageX/pageY`** at ~7 sites with no `getBoundingClientRect` correction. Works only because the draw canvas is `absolute inset-0` at the document origin at intrinsic resolution and `pageX/pageY` are document-relative (so scroll is absorbed). Any CSS-scaling of the canvas (responsive fit, browser zoom, a tablet shrinking the 3576 px bitmap) breaks the 1:1 mapping and the calibration drifts per device.

### Plan (sequenced)

1. **Store calibration in intrinsic units.** Persist `realUnitsPerPagePoint` (+ the two calibration points and entered length, in page units) instead of, or alongside, `pixelsPerMesh`. Derive `pixelsPerMesh = pagePointsPerMesh × currentRenderScale` on render. Cheapest store: the floor `settings` JSON (no DB migration). Invariant to device, DPI, zoom.
2. **Map pointer → canvas-intrinsic coords** everywhere: `x = (clientX - rect.left) * (canvas.width / rect.width)`. One shared helper; replace the raw `pageX/pageY` sites. This is the real "different device sizes" fix.
3. **Reset / re-measure flow.** On `Set scale` with an existing scale: show current scale (`1 m = N px`, derived) + the previous calibration line; offer **Re-measure** / **Change length** (pre-filled, recomputes without re-clicking) / **Cancel**. Add a real **Cancel** to `ScalePopup` and **Escape** to abort an in-progress measurement without destroying the committed scale.
4. **Safeguards.** Don't let autosave persist `pixels_per_mesh = 1` over a real value when the floor has elements; on load, if scale is unset but elements exist, prompt to set scale rather than silently showing no grid.

Open decisions (parked): persist the calibration line for cross-reload "Change length" (recommended, settings JSON) vs session-only; panel-on-re-entry vs straight-to-clicking. #1 and #2 are the device-robustness foundation and should land before the flow polish in #3.

## Deferred — ranked by expected user value

### 1. Shift-to-lock 0°/45°/90° with ORTHO badge

**What.** Swap ortho from Ctrl to Shift, and show a small "ORTHO" badge near the cursor when lock is active. 45° lock in addition to 0°/90° matches AutoCAD polar tracking.

**Why.** Shift is the convention in every non-AutoCAD app (Bluebeam Calibrate, Figma, tldraw, SketchUp). Ctrl is surprising for new users. Visible badge removes the "is ortho on?" guessing.

**Implementation sketch.**
- In the scale branch of `handlePointerDown`, replace `isCtrlPressed` gate on `snapVertexOrtho` with `isShiftPressed`.
- Extend `snapVertexOrtho` (or write a sibling) to also consider 45° — if `|dx - dy| < threshold`, snap to diagonal.
- In the render block beside the distance readout, draw a small filled pill with text "ORTHO" in the same cyan when Shift is held during scale.

**Risk.** Changing the Ctrl binding affects muscle memory for existing users. Could do both keys during a transition, or make it a preference.

**Source:** Bluebeam Calibrate Shift-lock, AutoCAD polar tracking (15°/30°/45°/90° increments).

### 2. Snap halo / aperture circle at cursor

**What.** Small circle at the cursor with radius = snap threshold in screen pixels. Stroke colour changes / thickens when a snap is currently hit.

**Why.** AutoCAD's aperture. Lets the user literally see how close to a feature they need to be before snap fires. Signals visually that snap is on.

**Prerequisite.** Only useful once Scale tool is on the alignment waterfall (deferred #4). Without alignment candidates, a halo would always show "no hit".

**Implementation sketch.** Single `context.arc(cursor.x, cursor.y, snapPx, 0, 2π)` with 1 px stroke in cyan. When alignment hits, bump to 2 px and change colour to match.

**Source:** AutoCAD `APERTURE` command (1–50 px, user-tunable).

### 3. Snap-type markers at cursor

**What.** On a snap hit, draw a shape at the snapped point indicating the snap type: filled square = endpoint, triangle = midpoint, circle = on-line, X = intersection. Accompanied by a short text label ("Endpoint", "Midpoint").

**Why.** SketchUp's inference markers. Tells the user exactly what they're grabbing before they commit, so they don't click a midpoint when they meant the endpoint.

**Prerequisite.** Needs alignment waterfall to be on (deferred #4) and optionally PDF-edge detection to snap to features on the underlying plan image (which we don't have today — scale happens before user-drawn elements exist).

**Implementation sketch.** In the render block, after resolving which snap fired, draw the shape at `{snapped.x, snapped.y}` with a 12 px label offset up-right. Reuse the existing magenta guide colour or a distinct cyan.

**Source:** SketchUp inference colour/shape system (endpoint green circle, midpoint light-blue circle, intersection red X, on-edge red square, on-face dark-blue diamond).

### 4. Put the Scale tool on the alignment waterfall

**What.** Swap `snapVertexToGrid(newP)` at `Canvas.jsx` (scale branch of `handlePointerDown`) for `snapVertexWithPointPriority(newP, null, scalePoints, isShiftPressed)`.

**Why.** Consistency with every other drawing tool. Low value at initial calibration (no elements exist yet) but higher value if the user re-calibrates after placing elements, or if we add PDF-feature detection later.

**Risk.** Near-zero. If `elements` is empty, `collectPointAlignmentCoordinates` returns empty, and the function falls back to grid snap — identical to current behaviour.

**Also:** consider passing `scalePoints` as `inProgressPoints` so click 2 can align to click 1's X or Y (same pattern as polyline/rect).

### 5. Asymmetric snap radius (click 1 bigger, click 2 smaller)

**What.** Temporarily speculative: first click uses e.g. 20 px snap radius (forgiving), second click uses 10 px (precise). Reasoning: click 1 is the anchor — a few px of slop doesn't change the derived ratio much. Click 2 defines length — tighter snap feels deliberate.

**Why.** No existing app does this explicitly, but it matches the psychology of calibration. Worth an A/B try before committing.

**Implementation sketch.** Add an optional `threshold` argument to the snap pipeline, default 15 px, override to 20 for first click.

### 6. Make Shift-toggle-crosshair / hide-crosshair

**What.** Some users hate a full-canvas crosshair. Expose a toggle — either persistent setting or hold-key-to-temporarily-hide.

**Why.** Bluebeam's Full-Screen Crosshair is an on/off preference, not always on.

**Implementation sketch.** `showCrosshair` preference in the store, default on. Checkbox in a settings UI or just a keyboard shortcut.

### 7. PDF-edge detection for snap candidates

**What.** Detect strong edges in the underlying PDF canvas (Canny or similar) and expose them as snap candidates so scale points can click on walls drawn in the PDF.

**Why.** This is the real "snap to the plan features" UX users probably assume already exists. Matches how Bluebeam Snap-to-Content works on PDFs.

**Effort.** Significant — needs image processing pipeline, tunable thresholds, probably worker offload. Own workstream, not a quick follow-up.

**Source:** Bluebeam "Snap to Content" option on the status bar — snaps cursor to endpoints/midpoints of vector content inside PDFs.

## References

- Bluebeam Revu Calibrate tool + Full-Screen Crosshair preference
- AutoCAD `APERTURE`, polar tracking, OTRACK, ortho mode
- SketchUp inference engine (colour-coded markers + inference lines)
- Adobe Acrobat Pro measurement tool
- tldraw `SnapManager` (open-source, MIT — see `packages/editor/src/lib/editor/managers/SnapManager/`)
- Excalidraw `snapping.ts` (open-source, MIT)

## Priority if someone picks this up later

1. **#1 Shift-ortho + badge** — small, high value, no prerequisites. Start here.
2. **#4 Waterfall swap** — one-line change, zero risk, unblocks #2 and #3.
3. **#2 Snap halo + #3 markers** — after #4. Cheap, give the tool a modern feel.
4. **#5 Asymmetric radius** — experiment after #4.
5. **#6 Toggle** — when the first user complains.
6. **#7 PDF edges** — its own project.
