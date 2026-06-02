# Phase 2 handover — namespace canvas geometry per mode

**Branch:** `dev` · **Pick up from commit:** `22b148f` (Phase 1) — rebase on latest `dev` first.
**Status:** ready to start now, in parallel with any Phase 1 follow-ups.
**Size estimate:** small (~3 store touch points + 1 migration + tests) if you take Strategy A below. Do **not** do the 30-site refactor unless you deliberately choose Strategy B.

## Why

All three modes (`fdsGen`, `radiation`, `timeEq`) draw onto one shared `store.elements` array. Each mode draws *different* element types (discriminated by `el.comments`): timeEq draws `obstruction`+`opening`, radiation draws `escapeRoute` (+ reads `fire`/`door`), fdsGen draws everything else (`mesh`, `stairObstruction`, `landing`, `inlet`, `extract`, `sprinkler`, `sensorTree`, …).

Because the array is shared, editing/deleting geometry in one mode mutates another mode's data in memory. Phase 0 (`shouldAutoSave` guard) and Phase 1 (DB-backing registry) stop *persistence* contamination, but the **in-memory** geometry is still one shared bucket. Phase 2 isolates it.

## Goal

Each mode owns its own geometry bucket over a shared PDF + scale. Switching modes must never let one mode's shapes appear in or overwrite another's.

Truly shared state (leave at top level, NOT per-mode): `pdfData`, `pixelsPerMesh`, `canvasDimensions`, `originPixels`, project meta (`projectId`/`floorId`/`projectName`), `tool`, `selectedElement`.

## Strategy A — sync-on-switch (recommended, low blast radius)

Keep `elements` as the live array for the **active** mode. Add a per-mode stash and swap it on mode change. Every existing consumer/mutator keeps reading/writing `state.elements` unchanged.

1. **Add state:** `elementsByMode: { fdsGen: [], radiation: [], timeEq: [] }` in the initial store object (`store/useStore.js:37` area).
2. **Swap in `setCurrentMode`** (`store/useStore.js:202`): on change, stash the current `elements` into `elementsByMode[oldMode]`, then load `elementsByMode[newMode] ?? []` into `elements`.
   ```js
   setCurrentMode: (newMode) => set((state) => {
     if (newMode === state.currentMode) return {}
     return {
       currentMode: newMode,
       elementsByMode: { ...state.elementsByMode, [state.currentMode]: state.elements },
       elements: state.elementsByMode[newMode] ?? [],
     }
   }),
   ```
   (Keep `elements` as the single source the canvas reads — the bucket for the active mode is "checked out" into `elements`.)
3. **Persistence** (`store/useStore.js`):
   - `partialize` (~line 598): add `elementsByMode`. Keep `elements` too (it's the active checkout).
   - `buildSavePayload` (~line 451) and `hydrateFromServer` (~line 519) currently read/write `s.elements` — that's correct for fdsGen since fdsGen's checkout lives in `elements` whenever a DB-backed mode is active. Leave as-is for Phase 2; Phase 3 will scope payloads per mode.
   - `resetProject` (~line 539): also reset `elementsByMode` to `{ fdsGen: [], radiation: [], timeEq: [] }`.
4. **Migration** — bump `PERSIST_VERSION` to `2` in `store/persistenceModes.js` and extend `migratePersistedState`:
   ```js
   if (fromVersion < 2) {
     // Old blobs had a single shared `elements`; it belonged to fdsGen.
     state = {
       ...state,
       elementsByMode: { fdsGen: state.elements ?? [], radiation: [], timeEq: [] },
     }
   }
   ```
   This is the critical backward-compat step for returning live users — without it their saved geometry would vanish from fdsGen.

That's it. The ~28 `state.elements` consumer sites and the 4 store mutators (`addElement` L147, sensor-regen L170, `setElements` L173, `removeElement` L182) need **no changes**.

## Strategy B — selector everywhere (purer, heavier; only if you have a reason)

Drop the live `elements` field; make `elements` a selector `state.elementsByMode[state.currentMode]`. Touches all consumers in: `Components/Canvas.jsx`, `Components/Toolbar.jsx`, `Components/FDSInputsPopup.tsx`, `Components/TimeEquivalenceInputPopup.jsx`, `Components/Gridlines.jsx`, `Components/TestButtons.jsx`, `pages/index.jsx`, and `utils/{autoSprinklers,corridorCenterline,findEnclosedRegions,shaftGeometry}.js`, plus the 4 store mutators. Not recommended unless Strategy A's "checkout" model causes a concrete problem.

## TDD plan (write these first)

New file `__tests__/per-mode-geometry.test.js`:
- Drawing in `fdsGen` then switching to `radiation` yields an empty `elements` (radiation bucket), and switching back restores the fdsGen geometry intact.
- An edit/`removeElement` while in `radiation` does **not** change `elementsByMode.fdsGen`.
- `setCurrentMode(sameMode)` is a no-op (doesn't wipe `elements`).
- `migratePersistedState(oldBlob, 1)` moves the legacy flat `elements` into `elementsByMode.fdsGen` and leaves the other buckets empty. (Add to `__tests__/persistence-modes.test.js`; also update its `PERSIST_VERSION >= 1` assertion is still fine.)
- `resetProject()` clears all three buckets.

Run with `npm test -- __tests__/per-mode-geometry.test.js __tests__/persistence-modes.test.js`. Note: `npx vitest` picks up the wrong vite — always use `npm test`.

## Merge coordination

Phase 1 already edited `store/useStore.js` (the `shouldAutoSave` body, the persist `version`/`migrate` options, and the `persistenceModes` import) and `store/persistenceModes.js` (`PERSIST_VERSION`, `migratePersistedState`). Phase 2 edits the same two files. Rebase on latest `dev` before starting and the overlaps are mechanical (different functions, except `migratePersistedState`/`PERSIST_VERSION` which you extend — append a new `if (fromVersion < 2)` branch, don't rewrite the v1 branch).

## Pre-existing test failures (ignore — not yours)

`__tests__/fds-inputs-leakage.test.jsx` (seal-type dropdown) and `__tests__/sensor-comparison.test.js` (corridor centerline geometry) fail on `dev` independent of this work. The Playwright `e2e/*.spec.ts` files "fail" under `npm test` because they need a running dev server. Don't chase these.
