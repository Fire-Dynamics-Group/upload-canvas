import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {findOriginPixels, returnFinalCoordinates} from '../utils/pointManipulation'
import { clearPdfFromIndexedDB } from '../utils/pdfStorage'
import { defaultDoorTimings } from './defaultDoorTimings'
import { isDbBacked, MODE_PERSISTENCE, PERSIST_VERSION, migratePersistedState, mergePersistedState, partializeState } from './persistenceModes'
import { fdsElementSignature } from '../utils/fdsSignature'

const useStore = create(persist((set, get) => {
    const defaultStairObject = {"fire_floor": 0, "total_floors": 5, "stair_roof_z": 25, "top_storey_height": 21}

    // Write the active mode's geometry: update the live `elements` array AND keep
    // the active mode's bucket (elementsByMode[currentMode]) in sync. The bucket
    // is the source of truth across reloads; `elements` is its live checkout.
    const writeElements = (state, nextElements) => ({
        elements: nextElements,
        elementsByMode: { ...state.elementsByMode, [state.currentMode]: nextElements },
    })

    // Undo/redo history depth (number of committed-element snapshots kept).
    const HISTORY_LIMIT = 50

    // Like writeElements, but records the prior elements on the undo stack and
    // clears the redo stack. Used for undoable user edits (add/remove/change).
    // Non-edit element writes (mode switch, hydrate, reset) use writeElements and
    // reset history themselves, so switching context never leaves a stale undo.
    const commitElements = (state, nextElements) => ({
        ...writeElements(state, nextElements),
        elementsHistory: [...state.elementsHistory, state.elements].slice(-HISTORY_LIMIT),
        elementsFuture: [],
    })

    return {

        // Project persistence
        projectId: null,
        floorId: null,
        projectName: null,
        saveStatus: null, // null | "saving" | "saved" | "error"

        elements: [],
        // Undo/redo stacks of committed-element snapshots (see commitElements).
        elementsHistory: [],
        elementsFuture: [],
        // Per-mode geometry buckets. `elements` is the live "checkout" of the
        // active mode's bucket; setCurrentMode stashes/restores between them so
        // modes can't clobber each other's shapes. See docs/phase2-*.md.
        elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
        tool: "scale",
        selectedElement: null,
        currentMode: "fdsGen",
        comment: "",
        canvasDimensions: {},
        pixelsPerMesh: 1,
        originPixels: null,
        convertedPoints: [],
        hasDoor: false,
        pdfData: null,
        pdfIsGreyscale: false,
        pdfCanvasRef: null,
        thumbnail: null,
        totalHeatFlux: 476,
        heatEndpoint: 1.3333,
        // EFS view-factor mode: column spacing (m) along the elevation. Shared by
        // the EFS popup and the canvas boundary-distance overlay.
        efsColumnSpacing: 8,
        // Elevation height + fire temperature inputs. Held in the store (not local
        // popup state) so they survive closing and reopening the popup.
        efsHeight: 18,
        efsFireTempC: 1040,
        // Whether the EFS popup is open, and whether a calc has been run — either
        // shows the gridline number labels on the canvas.
        efsPopupOpen: false,
        efsCalcDone: false,
        // EFS auto-protect (issue #8): scratch set of protected (fire-rated) bay
        // indices, and whether the auto-suggester protects corner bays first.
        efsCornersFirst: true,
        // Multiple elevations (issue #10): the drawn outline is split into faces;
        // the active tab index and per-elevation state keyed by face index.
        efsActiveElevation: 0,
        efsProtectedByElev: {},   // { [elevIdx]: number[] } protected bays per face
        efsRequiredByElev: {},    // { [elevIdx]: number[] } needed-boundary locus
        // Optional custom end-bay spacing per elevation (tick-box driven):
        // { [elevIdx]: { firstEnabled, firstSpacing, lastEnabled, lastSpacing } }.
        efsEndSpacingByElev: {},
        // Per-region vertical band (issue #11), keyed by the drawn region
        // element's id: { base, top } in metres (default 0..elevation height).
        efsRegionConfig: {},

        // Fire configuration
        fireHRR: 1000,              // kW
        fireDimension: 1.4,         // m (square fire side length)
        fireHeightAboveFloor: 0.5,  // m
        fireBase: 0.0,              // m
        fireType: "growing",        // "growing" or "steady_state"
        fireGrowthRate: "medium",   // "slow", "medium", "fast", "ultra_fast", "custom"
        fireCustomAlpha: null,      // kW/s², only used when fireGrowthRate is "custom"

        fireFloorZ: 0,
        fireFloorNumber: 0,
        showTimeEqPopup: false,
        numberOfStairs: 0,
        totalFloors: 8,
        stairRoofZ: 25,
        wallHeight: 3,
        topStoreyHeight: 20,

        // Common corridor mode
        commonCorridorMode: false,

        // Scenario settings (common corridor only)
        scenarioType: "MOE", // "MOE", "FSA", or "Both"
        simEndTime: 300,

        // Device settings
        includeSensors: true,
        corridorSensorHeights: [2.0], // above fire floor, all types (temp, pressure, vis, velocity)
        stairSensorHeights: [0.5, 1.0, 1.5, 2.0], // above fire floor, tree of sensors at each stair position
        fsaSensorHeights: [1.5], // above fire floor, FSA path sensors (2m/4m/15m from apt door)
        isSprinklered: true,

        // Door role assignment: { [doorId]: "apartment" | "stair" | "lobby" | "other" }
        doorRoles: {},
        highlightedDoorId: null,

        // Door leakage settings
        doorLeakagesEnabled: true,
        doorLeakageConfig: {}, // per-door: { [doorId]: { enabled: true, doorType: "single_smoke_sealed", bothSides: false } }

        // Door openings - defaults per scenario type
        doorOpenings: { ...defaultDoorTimings.MOE },

        // Landing role assignment: { [landingId]: "floor" | "half" }
        landingRoles: {},
        highlightedLandingId: null,
        // Which half of the floor landing goes up: "left"|"right"|"top"|"bottom"
        landingUpSide: null,
        // Stair step style: "overlapping" (full landing width shifted) | "individual" (single tread width)
        stairStyle: "individual",

        // Extract shaft settings
        extractConfig: {}, // per-extract: { [extractId]: { type, flowRate, tauV, shaftWidth, shaftDepth, activation, activationTime } }
        highlightedExtractId: null,

        // Inlet settings
        inletConfig: {}, // per-inlet: { [inletId]: { type, flowRate, tauV, openingHeight, openingBase } }
        highlightedInletId: null,

        // Zone assignment: { [elementId]: { type, name, slices, sensors, points } }
        // types: "corridor"|"lobby"|"fire_room"|"internal_corridor"|"other"
        zoneConfig: {},
        sliceZHeight: 2.0, // Z slice height above fire floor (m)

        // --- View tabs (2D draw / 3D model / FDS code) ---
        // Both the 3D view and the FDS-code view are derived from the FDS text
        // the backend returns (`fdsCode`), so they show ground truth — what FDS
        // will actually simulate — rather than a re-extrusion of the 2D elements.
        // `fdsGenSig` records the element signature at generation time so the
        // views can flag themselves stale once the drawing is edited further.
        viewMode: '2d',   // '2d' | '3d' | 'fds'
        fdsCode: '',      // last FDS text returned by the backend
        fdsGenSig: '',    // element signature captured when fdsCode was generated

        // Debug: decomposed rectangles for sensor visualization (pixel coords)
        debugRects: [], // flat array [x1,y1,x2,y2, ...] of rect corners in pixels

        // AOV settings
        aovMode: "always_open", // "always_open" | "timed" | "sprinkler"
        aovActivationTime: null, // seconds, used when aovMode is "timed"

        // Obstruction transparency settings (0 = opaque, 1 = fully transparent)
        obstructionTransparency: {
            stairWalls: 0.25,
            stairRoof: 0.25,
            fireFloorWalls: 0.0,
        },

        stairObject: [],
        mapStairObject: () => set((state) => ({
            stairObject: state.stairObject.map((stair, index) => {
                return {
                    ...defaultStairObject,
                    index: index
                }
            })
        })),
        // have local state and update object only when user clicks okay
        changeStairObject: (newStairObject) => set(() => ({
            stairObject: newStairObject
        })),
        
        addElement: (newEl) => set((state) => commitElements(state, [...state.elements, newEl])),

        // Undo/redo over committed elements. undo() steps back to the previous
        // snapshot (pushing the current onto the redo stack); redo() reverses it.
        // Both are no-ops at the ends of the stacks.
        undo: () => set((state) => {
            if (state.elementsHistory.length === 0) return {}
            const prev = state.elementsHistory[state.elementsHistory.length - 1]
            return {
                ...writeElements(state, prev),
                elementsHistory: state.elementsHistory.slice(0, -1),
                elementsFuture: [state.elements, ...state.elementsFuture].slice(0, HISTORY_LIMIT),
            }
        }),
        redo: () => set((state) => {
            if (state.elementsFuture.length === 0) return {}
            const next = state.elementsFuture[0]
            return {
                ...writeElements(state, next),
                elementsHistory: [...state.elementsHistory, state.elements].slice(-HISTORY_LIMIT),
                elementsFuture: state.elementsFuture.slice(1),
            }
        }),
        canUndo: () => get().elementsHistory.length > 0,
        canRedo: () => get().elementsFuture.length > 0,
        // Replace all sensorTree and fsaSensor elements with new ones
        setSensorTreeElements: (sensorPoints, fsaPoints = []) => set((state) => {
            const withoutSensors = state.elements.filter(el => el.comments !== 'sensorTree' && el.comments !== 'fsaSensor')
            const maxId = withoutSensors.length > 0
                ? Math.max(...withoutSensors.map(el => el.id))
                : -1
            const newSensors = sensorPoints.map((pt, i) => ({
                type: 'point',
                points: [pt],
                comments: 'sensorTree',
                id: maxId + 1 + i,
                ...(pt.zoneName ? { zoneName: pt.zoneName } : {}),
            }))
            const newFsa = fsaPoints.map((pt, i) => ({
                type: 'point',
                points: [pt],
                comments: 'fsaSensor',
                fsaDistance: pt.fsaDistance, // 2, 4, or 15 metres from apt door
                id: maxId + 1 + sensorPoints.length + i,
            }))
            return writeElements(state, [...withoutSensors, ...newSensors, ...newFsa])
        }),
        changeElement: (changedEl) => set((state) => commitElements(
            state,
            state.elements.map(element => element.id === changedEl.id ? changedEl : element)
        )),
        removeElement: (selectedID) => set((state) => commitElements(
            state,
            state.elements.filter(element => element.id !== selectedID)
        )),
        // change tool to incoming
        // if tool not selection; set selection to null
        setTool: (newTool) => {
            set(() => {
                if (newTool != 'selection') 
                return {
                    tool: newTool,
                    selectedElement: null,
                }
                return {
                    tool: newTool
                }
            }
            )
        },

        setSelectedElement: (newEl) => set(() => ({
            selectedElement: newEl
        })),
        // Switching modes checks out the new mode's geometry bucket into the
        // live `elements` array. The outgoing mode's bucket is already current
        // (writeElements keeps it in sync), so no stash step is needed.
        //
        // The PDF + scale (pdfData, pixelsPerMesh, canvasDimensions,
        // convertedPoints, originPixels) are global, not bucketed. A non-DB mode
        // (radiation/timeEq) is ephemeral scratch and must NOT inherit them from
        // the mode you came from — it starts from a fresh upload + scale step.
        // We only reset for non-DB targets: fdsGen re-hydrates from its project,
        // and blanking its scale here would let auto-save clobber the project
        // with defaults. See persistenceModes.js.
        setCurrentMode: (newMode) => set((state) => {
            if (newMode === state.currentMode) return {}
            const next = {
                currentMode: newMode,
                elements: state.elementsByMode?.[newMode] ?? [],
                // Undo history is per editing context; don't let an undo reach
                // back across a mode switch into another mode's geometry.
                elementsHistory: [],
                elementsFuture: [],
            }
            if (!isDbBacked(newMode)) {
                return {
                    ...next,
                    pdfData: null,
                    pdfIsGreyscale: false,
                    pixelsPerMesh: 1,
                    canvasDimensions: {},
                    convertedPoints: [],
                    originPixels: null,
                    hasDoor: false,
                    tool: 'scale',
                    selectedElement: null,
                }
            }
            return next
        }),
        setComment: (newComment) => set(() => ({
            comment: newComment
        })),
        setCanvasDimensions: (dimensions) => set(() => ({
            canvasDimensions: dimensions
        })),
        setPixelsPerMesh: (pxPerMesh) => set(() => ({
            pixelsPerMesh: pxPerMesh
        })),
        // Changing the column spacing re-lays the bays, so any protected-bay
        // selection (indexed by bay) no longer maps — clear it for all faces.
        setEfsColumnSpacing: (v) => set(() => ({ efsColumnSpacing: v, efsProtectedByElev: {}, efsRequiredByElev: {} })),
        setEfsHeight: (v) => set(() => ({ efsHeight: v })),
        setEfsFireTempC: (v) => set(() => ({ efsFireTempC: v })),
        // (efsRegionConfig is keyed by element id, so it survives a spacing change;
        // regions re-snap to the new bays on the next assessment.)
        setEfsPopupOpen: (v) => set(() => ({ efsPopupOpen: v })),
        setEfsCalcDone: (v) => set(() => ({ efsCalcDone: v })),
        setEfsActiveElevation: (i) => set(() => ({ efsActiveElevation: i })),
        // Protected bays per elevation (issues #8/#10): the shared set the manual
        // table toggles and the auto-suggester read/write, keyed by face index.
        setEfsProtectedForElev: (i, bays) => set((state) => ({
            efsProtectedByElev: { ...state.efsProtectedByElev, [i]: [...bays].sort((a, b) => a - b) },
        })),
        toggleEfsProtectedForElev: (i, bay) => set((state) => {
            const cur = state.efsProtectedByElev[i] || []
            const next = cur.includes(bay)
                ? cur.filter((b) => b !== bay)
                : [...cur, bay].sort((a, b) => a - b)
            return { efsProtectedByElev: { ...state.efsProtectedByElev, [i]: next } }
        }),
        setEfsRequiredForElev: (i, arr) => set((state) => ({
            efsRequiredByElev: { ...state.efsRequiredByElev, [i]: arr },
        })),
        setEfsCornersFirst: (v) => set(() => ({ efsCornersFirst: v })),
        setEfsEndSpacingForElev: (i, patch) => set((state) => ({
            efsEndSpacingByElev: { ...state.efsEndSpacingByElev, [i]: { ...state.efsEndSpacingByElev[i], ...patch } },
        })),
        setEfsRegionBand: (id, band) => set((state) => ({
            efsRegionConfig: { ...state.efsRegionConfig, [id]: { ...state.efsRegionConfig[id], ...band } },
        })),

        setConvertedPoints: () => set((state) => {
            let tempOrigin = findOriginPixels(state.elements, state.canvasDimensions.height)
            console.log("tempOrigin: ", tempOrigin)
            return{
                originPixels: tempOrigin,
                convertedPoints: returnFinalCoordinates(state.pixelsPerMesh * 10 , state.elements, tempOrigin, state.canvasDimensions.height)
            }
        }),
        mockConvertedPoints: (mockedConvertedPoints) => set(() => ({
                convertedPoints: mockedConvertedPoints
        })),

        setHasDoor: (newBool) => set(() => ({
            hasDoor: newBool
        })),

        setPdfData: (newPdfData) => set(() => ({
            pdfData: newPdfData
        })),
        toggleIsPdfGreyscale: (newBool) => set(() => ({
            pdfIsGreyscale: newBool
        })),
        setPdfCanvasRef: (newRef) => set(() => ({
            pdfCanvasRef: newRef
        })),
        setThumbnail: (dataUrl) => set(() => ({
            thumbnail: dataUrl
        })),
        setTotalHeatFlux: (newVal) => set(() => ({
            totalHeatFlux: newVal
        })),
        setHeatEndpoint: (newVal) => set(() => ({
            heatEndpoint: newVal
        })),

        // Fire configuration setters
        setFireHRR: (newVal) => set(() => ({ fireHRR: newVal })),
        setFireDimension: (newVal) => set(() => ({ fireDimension: newVal })),
        setFireHeightAboveFloor: (newVal) => set(() => ({ fireHeightAboveFloor: newVal })),
        setFireBase: (newVal) => set(() => ({ fireBase: newVal })),
        setFireType: (newVal) => set(() => ({ fireType: newVal })),
        setFireGrowthRate: (newVal) => set(() => ({ fireGrowthRate: newVal })),
        setFireCustomAlpha: (newVal) => set(() => ({ fireCustomAlpha: newVal })),

        setShowTimeEqPopup: (newBool) => set(() => ({
            showTimeEqPopup: newBool
        })),
        setFireFloorZ: (newVal) => set(() => ({
            fireFloorZ: newVal
        })),
        // setFireFloorZ: (newVal) => set(() => ({
        //     fireFloorZ: newVal
        // })),
        setFireFloorNumber: (newVal) => set(() => ({
            fireFloorNumber: newVal
        })),
        setTotalFloors: (newVal) => set(() => ({
            totalFloors: newVal
        })),
        setWallHeight: (newVal) => set(() => ({
            wallHeight: newVal
        })),
        setStairRoofZ: (newVal) => set(() => ({
            stairRoofZ: newVal
        })),
        setTopStoreyHeight: (newVal) => set(() => ({
            topStoreyHeight: newVal
        })),

        setAovMode: (newVal) => set(() => ({
            aovMode: newVal,
            // Clear activation time when switching away from timed
            ...(newVal !== "timed" ? { aovActivationTime: null } : {}),
        })),
        setAovActivationTime: (newVal) => set(() => ({
            aovActivationTime: newVal
        })),

        setCommonCorridorMode: (newVal) => set(() => ({
            commonCorridorMode: newVal,
            // Reset scenario defaults when toggling on
            ...(newVal ? {
                scenarioType: "MOE",
                doorOpenings: { ...defaultDoorTimings.MOE },
                simEndTime: 300,
            } : {
                scenarioType: null,
                doorOpenings: {},
            }),
        })),

        // Scenario setters (common corridor only)
        setScenarioType: (newVal) => set(() => ({
            scenarioType: newVal,
            doorOpenings: { ...defaultDoorTimings[newVal] },
            simEndTime: newVal === "Both" ? 1800 : 300,
        })),
        setSimEndTime: (newVal) => set(() => ({
            simEndTime: newVal
        })),

        // Device setters
        setIncludeSensors: (newVal) => set(() => ({
            includeSensors: newVal
        })),
        setCorridorSensorHeights: (newVal) => set(() => ({
            corridorSensorHeights: newVal
        })),
        setStairSensorHeights: (newVal) => set(() => ({
            stairSensorHeights: newVal
        })),
        setFsaSensorHeights: (newVal) => set(() => ({
            fsaSensorHeights: newVal
        })),
        setIsSprinklered: (newVal) => set(() => ({
            isSprinklered: newVal
        })),

        // Door role setters
        setDoorRoles: (newVal) => set(() => ({
            doorRoles: newVal
        })),
        setHighlightedDoorId: (newVal) => set(() => ({
            highlightedDoorId: newVal
        })),

        // Door leakage setters
        setDoorLeakagesEnabled: (newVal) => set(() => ({
            doorLeakagesEnabled: newVal
        })),
        setDoorLeakageConfig: (newVal) => set(() => ({
            doorLeakageConfig: newVal
        })),

        // Door openings setter
        setDoorOpenings: (newVal) => set(() => ({
            doorOpenings: newVal
        })),

        // Extract shaft setters
        setExtractConfig: (newVal) => set(() => ({
            extractConfig: newVal
        })),
        setHighlightedExtractId: (newVal) => set(() => ({
            highlightedExtractId: newVal
        })),

        // Inlet setters
        setInletConfig: (newVal) => set(() => ({ inletConfig: newVal })),
        setHighlightedInletId: (newVal) => set(() => ({ highlightedInletId: newVal })),

        // Zone setters
        setZoneConfig: (newVal) => set(() => ({ zoneConfig: newVal })),
        setSliceZHeight: (newVal) => set(() => ({ sliceZHeight: newVal })),

        // Landing role setters
        setLandingRoles: (newVal) => set(() => ({ landingRoles: newVal })),
        setHighlightedLandingId: (newVal) => set(() => ({ highlightedLandingId: newVal })),
        setLandingUpSide: (newVal) => set(() => ({ landingUpSide: newVal })),
        setStairStyle: (newVal) => set(() => ({ stairStyle: newVal })),

        // Obstruction transparency setter
        setObstructionTransparency: (newVal) => set(() => ({ obstructionTransparency: newVal })),
        setDebugRects: (newVal) => set(() => ({ debugRects: newVal })),

        // --- View tabs + captured FDS text ---
        setViewMode: (newVal) => set(() => ({ viewMode: newVal })),
        // Store the FDS text the backend returned, tagging it with the current
        // element signature so the 3D/FDS views know when they've gone stale.
        captureFds: (text) => set((state) => ({
            fdsCode: typeof text === 'string' ? text : '',
            fdsGenSig: fdsElementSignature(state.elements),
        })),
        // True once fdsCode exists and the drawing has changed since it was made.
        isFdsStale: () => {
            const s = get()
            return Boolean(s.fdsCode) && fdsElementSignature(s.elements) !== s.fdsGenSig
        },

        // Project persistence setters
        setProjectId: (newVal) => set(() => ({ projectId: newVal })),
        setFloorId: (newVal) => set(() => ({ floorId: newVal })),
        setProjectName: (newVal) => set(() => ({ projectName: newVal })),
        setSaveStatus: (newVal) => set(() => ({ saveStatus: newVal })),

        // Auto-save only fires for DB-backed modes (see persistenceModes.js).
        // Otherwise scratch geometry from a non-DB mode (radiation/timeEq) could
        // overwrite the loaded project. Registry-driven so new modes opt in by
        // flipping a flag, not by editing this check.
        shouldAutoSave: () => {
            const s = get()
            return Boolean(s.projectId) && isDbBacked(s.currentMode)
        },

        // Build the bulk-save payload via the active mode's registry handler.
        // Returns null for modes that aren't DB-backed (no handler).
        buildSavePayload: () => {
            const s = get()
            const handler = MODE_PERSISTENCE[s.currentMode]
            return handler?.buildPayload ? handler.buildPayload(s) : null
        },

        // Hydrate the store from a loaded project + floor detail via the active
        // mode's registry handler. No-op for modes that aren't DB-backed.
        hydrateFromServer: (project, floorDetail) => {
            const handler = MODE_PERSISTENCE[get().currentMode]
            if (!handler?.hydrate) return
            set((state) => handler.hydrate(project, floorDetail, state))
        },

        // Reset all persisted state for a new project
        resetProject: () => {
            localStorage.removeItem('upload-canvas-fds')
            clearPdfFromIndexedDB()
            set(() => ({
                projectId: null,
                floorId: null,
                projectName: null,
                saveStatus: null,
                elements: [],
                elementsByMode: { fdsGen: [], radiation: [], timeEq: [], efs: [] },
                viewMode: '2d',
                fdsCode: '',
                fdsGenSig: '',
                tool: "scale",
                selectedElement: null,
                comment: "",
                canvasDimensions: {},
                pixelsPerMesh: 1,
                originPixels: null,
                convertedPoints: [],
                hasDoor: false,
                efsActiveElevation: 0,
                efsProtectedByElev: {},
                efsRequiredByElev: {},
                efsEndSpacingByElev: {},
                efsRegionConfig: {},
                efsCalcDone: false,
                pdfData: null,
                pdfIsGreyscale: false,
                totalHeatFlux: 476,
                heatEndpoint: 1.3333,
                fireHRR: 1000,
                fireDimension: 1.4,
                fireHeightAboveFloor: 0.5,
                fireBase: 0.0,
                fireType: "growing",
                fireGrowthRate: "medium",
                fireCustomAlpha: null,
                fireFloorZ: 0,
                fireFloorNumber: 0,
                numberOfStairs: 0,
                totalFloors: 8,
                stairRoofZ: 25,
                wallHeight: 3,
                topStoreyHeight: 20,
                commonCorridorMode: false,
                scenarioType: "MOE",
                simEndTime: 300,
                includeSensors: true,
                corridorSensorHeights: [2.0],
                stairSensorHeights: [0.5, 1.0, 1.5, 2.0],
                fsaSensorHeights: [1.5],
                isSprinklered: true,
                doorRoles: {},
                highlightedDoorId: null,
                doorLeakagesEnabled: true,
                doorLeakageConfig: {},
                doorOpenings: { ...defaultDoorTimings.MOE },
                landingRoles: {},
                highlightedLandingId: null,
                landingUpSide: null,
                stairStyle: "individual",
                extractConfig: {},
                highlightedExtractId: null,
                inletConfig: {},
                highlightedInletId: null,
                zoneConfig: {},
                sliceZHeight: 2.0,
                aovMode: "always_open",
                aovActivationTime: null,
                obstructionTransparency: { stairWalls: 0.25, stairRoof: 0.25, fireFloorWalls: 0.0 },
                stairObject: [],
            }))
        },
}
}, {
    name: 'upload-canvas-fds',
    version: PERSIST_VERSION,
    migrate: migratePersistedState,
    merge: mergePersistedState,
    // Registry-driven: non-DB modes leave nothing behind to restore on reload.
    partialize: partializeState,
}))

// Dev/test only: expose the store so Playwright e2e can read/seed state.
// Never attached in production builds.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    window.__useStore = useStore
}

export { defaultDoorTimings }
export default useStore