# Handover: Structural Fire Assessment UX & Projects Hub

## Context & Objectives
In the current application, structural fire engineering workflows are fragmented:
1. **Ambiguous Terminology**: The term "Studio" / "SFE Studio" is internal jargon. For structural fire engineers, the workspace is a **Structural Fire Assessment** (evaluating MACS+ composite slab calculations, critical temperatures, and Monte Carlo time equivalence).
2. **Inverted Entry Flow**: Clicking a project card in the dashboard previously dumped users into the 2D CAD canvas. However, the structural assessment is the primary workspace; the 2D CAD canvas is only needed when drawing or modifying the compartment boundary for **Time Equivalence**.
3. **Uninformative Project Cards**: Cards only displayed an architectural plan image (or a dark "No preview" box). Structural engineers need to see MACS data status, governing beam sections, critical failure temperatures, simulation runs, and pass rates at a glance.
4. **Header Navigation**: In the assessment page (`/structural-fire`), switching projects used an uninformative HTML `<select>` with plain names and no easy way to return to the projects gallery.

---

## User Stories & Workflow Architecture

```
[ Mode: MACS+ & Time Equivalence ]
               │
               ▼
[ Structural Projects Hub ]
  Rich Cards: MACS status, governing beam, batch size, reliability pass rate
               │
               │ (Click Card -> Always opens the Assessment)
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Structural Fire Assessment (/structural-fire?project=...)              │
│                                                                        │
│  [ Tab 1: MACS+ Batch & Slabs ]    [ Tab 2: Time Equivalence & MC ]    │
│  • Governing Section (UB 457x191)  • Fire load & ventilation inputs    │
│  • Critical Temp & Ap/V            • Monte Carlo reliability curves    │
│  • 10k Batch distribution & shear  • ─── Compartment Geometry ───────  │
│                                    │  [ Mini-Map Preview ]             │
│                                    │  [ 📐 Open Compartment Plan ] ──┐ │
└────────────────────────────────────┴─────────────────────────────────┼─┘
                                                                       │
                                      (Only when adjusting geometry)   ▼
                                     ┌───────────────────────────────────┐
                                     │ 2D Canvas Drawing (/)             │
                                     │ • Calibrate drawing scale         │
                                     │ • Draw compartment & openings     │
                                     │ • [← Back to Assessment] ─────────┘
```

---

## Specification Details

### 1. Mode Naming & Terminology Unification
* **Unified Mode Label**: `MACS+ & Time Equivalence` (subtitle: *Composite Slab & Monte Carlo Fire Resistance*).
* **Purge "Studio" Terminology**:
  * Replace "SFE Studio" / "Structural Fire Engineering Studio" with **"Structural Fire Assessment"**.
  * Card button: **"Open Assessment"** (or click card).
  * Canvas back button: **"← Back to Assessment"** (replaces "Back to SFE Studio").

### 2. Rich Structural Project Card
When `currentMode === 'timeEq'`, project cards in `ProjectDashboard.jsx` display structural engineering metadata instead of just the generic floor plan thumbnail:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [ Mini Heat Map / Beam Diagram ]             [🟢 MACS: 10k Runs · 99.2%]│
│                                                 (or [⚪ Awaiting MACS]) │
│ ─────────────────────────────────────────────────────────────────────── │
│  Warehouse Bay 4 - Office Floor                                         │
│  Updated 2h ago by Ian Shaw                                             │
│                                                                         │
│  ┌─ Engineering Summary ──────────────────────────────────────────────┐ │
│  │ 🏛️ Governing: UB 457×191×82 (S355) · 3-sided exposure               │ │
│  │ 🔥 Critical Temp: 631°C · Ap/V: 140 m⁻¹                            │ │
│  │ ⏱️ Time Equivalence: REI 90 · Target: Office Occupancy              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [ Open Assessment → ]                              [ ℹ️ Quick Peek ]    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Card Details & Honesty Rules:
* **MACS Status Pill**:
  * `🟢 MACS: 10k Runs · 99.2% Pass` (when batch completed).
  * `🟡 MACS: 10k Runs · Shear Alert` (when runs are below shear capacity limit).
  * `🔵 MACS: Single Run Synced` (governing run received from i-macs).
  * `⚪ Awaiting MACS Data` (honest empty state when no runs or handoffs exist; per AGENTS.md, **never show fake fallback metrics** like "9,999 pass").
* **Key Metrics**:
  * Governing section (from `project.settings.macsBatch.governing_section` or `project.settings.timeEqInputs.section`).
  * Critical temperature and section factor ($A_p/V$).
  * Fire resistance period / occupancy target.
* **Interactive Quick Peek Popover (`ℹ️`)**:
  * Displays workstation name, Windows user, and timestamp of receipt.
  * Utilization factor ($UF_{\text{max}}$) and slab deflection.
  * Compartment area ($m^2$) and ventilation summary.

### 3. Direct Routing & Navigation
* **Primary Card Click**:
  * In `timeEq` mode, clicking anywhere on the card executes `router.push('/structural-fire?project=' + project.id)`.
* **In-Assessment Navigation (`pages/structural-fire.jsx`)**:
  * Top bar adds a **"← All Projects"** link to return to the Projects Hub.
  * Replaces the native `<select>` dropdown with a searchable **Project Switcher Dropdown** displaying project names with their MACS status badges.
* **Canvas Access Nested under Time Equivalence**:
  * The canvas is accessed from `TimeEqWorkspace.jsx` via the **"📐 Open Compartment Plan"** button next to the `CompartmentMiniMap`.
  * Passing `?project=${id}&returnTo=structural-fire` keeps continuity.
  * Canvas top bar displays **"← Back to Assessment"**.

---

## Implementation Checklist

- [ ] **Phase 1: Terminology & Routing**
  - [ ] Unify mode label to `MACS+ & Time Equivalence` across `ModePopup.jsx`, `ProjectDashboard.jsx`, and `Toolbar.jsx`.
  - [ ] Update card click handler in `ProjectDashboard.jsx` to navigate to `/structural-fire?project=${project.id}` when in `timeEq` mode.
  - [ ] Replace "Studio" strings with "Structural Fire Assessment" across UI components.
  - [ ] Update canvas back button to say "← Back to Assessment".

- [ ] **Phase 2: Rich Structural Cards & Quick Peek**
  - [ ] Extract / build `StructuralProjectCard.jsx` (or enhance `ProjectDashboard.jsx`).
  - [ ] Render MACS status badge, governing section, and critical temp from `project.settings`.
  - [ ] Implement hover/click `QuickPeek` popover showing detailed batch and compartment stats.
  - [ ] Ensure strict honest fallbacks (`Awaiting MACS Data`, no mock 10k/9999 runs).

- [ ] **Phase 3: Assessment Header Switcher & Time Eq Integration**
  - [ ] Add "← All Projects" button to `pages/structural-fire.jsx` header.
  - [ ] Replace native `<select>` with a rich dropdown showing project badges and a "+ New" shortcut.
  - [ ] Strengthen the "📐 Open Compartment Plan" CTA in `TimeEqWorkspace.jsx`.

---

## Testing & Verification
1. **Unit Tests**:
   - `__tests__/project-dashboard-mode.test.jsx`: Verify that clicking a card in `timeEq` mode routes to `/structural-fire?project=${id}`.
   - `__tests__/structural-fire-studio.test.jsx`: Verify header navigation, "← All Projects" link, and rich project switcher.
2. **Visual & E2E Verification**:
   - Verify card rendering with existing test fixture: `e2e/fixtures/24369-UMC-01SI-ZZ-DR-A-0611-C01-Site_Plan.pdf`.
   - Verify that projects without MACS runs display honest empty states.
