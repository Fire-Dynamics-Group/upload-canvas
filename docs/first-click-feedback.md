# First-click feedback — canvas drawing tools

Spec for giving the user a visible indicator of where the first click of any drawing tool will actually land, before they commit. Fills the gap between vertex 1 (currently blind on most tools) and vertex N+1 (which already renders alignment guides + rubber-band).

## Problem

After the first click of a polyline, rect, or scale, the canvas renders a rubber-band to the cursor plus magenta alignment guides (`Components/Canvas.jsx:440-472`). Before any click, only two things happen:

- **Scale tool** — cyan full-canvas crosshair tracks the cursor (`Canvas.jsx:1326-1337`), but tracks the *raw* cursor while the click itself applies `snapVertexToGrid`. The crosshair and the landed point can disagree by up to `pixelsPerMesh/2` px.
- **Point tool** — waterfall snap is computed and magenta alignment guides are drawn on hover (`Canvas.jsx:477-489`), but no marker is rendered at the snapped cursor. The user sees which axes will snap, not the exact point.

Every other tool (rect, polyline, 2-point elements like doors/inlets/extracts) falls into the plain `else` branch — no guide, no marker, no crosshair. The user clicks blind.

Single-click tools (sensors, devices) are the worst case: there is no second click to correct a misplaced first click. If the waterfall pulls the click 15 px toward an existing vertex, the user only discovers this after the element is already placed.

## Rule

**Vertex N+1 feedback = vertex 1 feedback + rubber-band.**

The waterfall pipeline is vertex-agnostic — `snapVertexWithPointPriority` accepts an `inProgress` array that may be empty. Only the rubber-band depends on a previous anchor. So every drawing tool should share one hover pipeline that fires the moment the tool is selected, and the existing post-first-click rendering becomes that same pipeline plus a rubber-band.

## Per-tool target

What should render at each stage. Shift held still bypasses the alignment layer and falls to grid-only, same as today.

| Tool | Before 1st click | After 1st click (already shipped, for reference) |
|---|---|---|
| point (sensor, device) | guides + marker at snapped | — (single-click) |
| 2-point (door, inlet, extract) | guides + marker at snapped | + rubber-band from p0 |
| polyline (wall) | guides + marker at snapped | + rubber-band from last vertex + close-snap halo near start |
| rect (mesh, landing, sensor box) | guides + marker at snapped | + rubber-rect preview |
| scale | cyan crosshair (today) + marker at snapped (new) | + rubber-band + px distance label |

The "marker" is the one visual that is missing everywhere. Spec: 4-6 px filled dot, magenta to match the alignment-guide colour so marker + guides read as one "snap system".

Mesh drawing keeps its own isolated path (`snapVertexWithMeshPriority`, `snapToMeshEdges`) — the marker/guides still render, just sourced from mesh edges only, consistent with the mesh-isolation rule in `fds-mesh-alignment-rules.md`.

## Scale tool — two sub-gaps

Scale is the only tool with *any* pre-first-click indicator. It has two specific gaps on top of the generic "no marker" problem:

1. **Crosshair tracks raw cursor, click snaps.** Point `guideLine` at the snapped position, not the raw cursor, so the crosshair and the landed dot coincide.
2. **Scale is not on the waterfall.** Tracked as deferred item #4 in `docs/scale-tool-ux.md`. Once scale is on the waterfall, the marker + alignment guides defined here apply to it unchanged. The cyan full-canvas crosshair stays as a scale-specific flourish — distinct visual language ("calibration mode") that doesn't override the magenta snap system.

## Implementation sketch

Target file: `Components/Canvas.jsx`.

### `handleMouseMove` effect (currently `Canvas.jsx:423-507`)

Consolidate the rect / polyline / point / scale branches into one drawing-tool branch:

```js
if (isDrawingTool(tool)) {
  const raw = { x: event.pageX, y: event.pageY }
  const inProgress = tool === 'rect' ? currentRect : tool === 'polyline' ? currentPoly : []
  const isMeshRect = tool === 'rect' && comment?.toLowerCase().includes('mesh')

  if (isShiftPressed || currentMode === 'radiation') {
    setGuideLine(raw)            // or grid-snapped raw, matching click behaviour
    setSnapGuides([])
  } else if (isMeshRect) {
    const { snapped, guides } = snapToMeshEdges(raw)
    setGuideLine(applyGridFallback(snapped, guides, pixelsPerMesh))
    setSnapGuides(guides)
  } else {
    const coords = collectPointAlignmentCoordinates(elements, null, inProgress)
    const { snapped, guides } = snapToPointAlignment(raw, coords, MESH_SNAP_THRESHOLD)
    setGuideLine(applyGridFallback(snapped, guides, pixelsPerMesh))
    setSnapGuides(guides)
  }
}
```

`applyGridFallback` is the 4-line pattern repeated at `Canvas.jsx:436-437`, `452-453`, `468-469` — extract once.

Key behaviour change: the branch fires on pure hover (no `isDrawing` / `currentRect.length === 1` gate), so vertex-1 and vertex-N share the same path.

### Render effect (currently ends at `Canvas.jsx:1373`)

After the `snapGuides` draw block, add an always-on marker when a drawing tool is active and `guideLine` is set:

```js
if (isDrawingTool(tool) && guideLine) {
  context.save()
  context.fillStyle = '#ff00ff'
  context.beginPath()
  context.arc(guideLine.x, guideLine.y, 4, 0, Math.PI * 2)
  context.fill()
  context.restore()
}
```

For scale, keep the existing cyan crosshair block at `Canvas.jsx:1326-1337` — it now sits on top of the magenta marker because `guideLine` is already snapped.

### What stays

- Mesh-isolation: mesh rect drawing still uses `snapToMeshEdges`, not the point waterfall. The marker renders the same way.
- Shift override: still skips the alignment layer entirely.
- Close-snap halo near polyline start: unchanged (still post-first-click).
- Rubber-band rendering: unchanged (still gated on click count ≥ 1).

## Risks

- **Visual noise.** A persistent magenta dot + alignment lines whenever any drawing tool is selected is louder than the current silent state. Mitigations: only show guides when an actual snap fires (already the case — `snapGuides` is empty when nothing hits); keep the marker small (4 px); consider a per-user toggle, same pattern as deferred #6 in `scale-tool-ux.md`.
- **Mesh path currently has no Shift override.** Noted in the summary table in `fds-mesh-alignment-rules.md`. Wiring one in is outside this spec but would be natural to do at the same time.
- **Performance.** Waterfall fires on every `mousemove` already for post-first-click. Extending to pre-first-click roughly doubles the event rate the handler is active for. `collectPointAlignmentCoordinates` is O(elements); on projects with >1000 elements this may need throttling or a precomputed coord cache. Profile before optimising.

## Related work

- `docs/scale-tool-ux.md` — scale-specific UX, shipped + deferred. This spec generalises deferred items #2 (snap halo) and #3 (snap-type markers) to all drawing tools, not just scale.
- `docs/fds-mesh-alignment-rules.md` — mesh isolation rule and the everything-else waterfall. This spec does not change either rule; it changes *when* the feedback for the waterfall renders.

## Priority

High for single-click tools (point = sensor, device) — there is no second click to recover from a bad first click. Medium for 2-point and rect — the rubber-band is already forgiving. Lowest for scale — the crosshair is already there; the two sub-gaps are small polish.

Suggested order:

1. Extract `applyGridFallback` helper + consolidate hover branches (no visual change yet).
2. Add marker render block. Ship with point tool only to validate the visual.
3. Enable for rect + polyline + 2-point.
4. Wire scale onto the waterfall (closes deferred #4 in `scale-tool-ux.md`); marker appears for free.
