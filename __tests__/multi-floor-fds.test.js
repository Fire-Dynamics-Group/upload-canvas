// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen, act } from '@testing-library/react'
import FloorBar, { AddFloorClusterButton } from '../Components/FloorBar'
import useStore from '../store/useStore'
import { buildFdsPayload, hydrateFdsState } from '../store/fdsPersistence'
import {
  mapPointBetweenFloors,
  transformElementBetweenFloors,
  generateInterFloorSlabLines,
  combineMultiFloorFds,
} from '../utils/multiFloorFds'
import { parseFdsGeometry } from '../utils/fdsParse'
import { buildFdsScene } from '../utils/fdsScene'
import { generateFdsCode } from '../utils/generateFds'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const RAILWAY_DEV_API = 'https://backendfornextapp-dev.up.railway.app'
const FDS_OUTPUT_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/multi-floor-fds-output'
const ALIGN_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/multi-floor-mesh-align'

function parseMeshTable(fdsText) {
  return (fdsText || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().toUpperCase().startsWith('&MESH'))
    .map((line) => {
      const id = line.match(/ID='([^']+)'/i)?.[1]
      const ijk = line.match(/IJK=\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/i)
      const xb = (line.match(/XB=\s*([^/]+)/i)?.[1] || '').split(',').map(Number)
      return {
        id,
        i: ijk ? Number(ijk[1]) : undefined,
        j: ijk ? Number(ijk[2]) : undefined,
        k: ijk ? Number(ijk[3]) : undefined,
        xmin: xb[0],
        xmax: xb[1],
        ymin: xb[2],
        ymax: xb[3],
        zmin: xb[4],
        zmax: xb[5],
        line,
      }
    })
}

function meshRect(id, size = 100) {
  return {
    id,
    type: 'rect',
    comments: 'mesh',
    points: [
      { x: 0, y: 0 },
      { x: size, y: 0 },
      { x: size, y: size },
      { x: 0, y: size },
    ],
  }
}

function wallLine(id, size = 100) {
  return {
    id,
    type: 'polyline',
    comments: 'obstruction',
    points: [{ x: 0, y: 0 }, { x: size, y: 0 }],
  }
}

function openingRect(id) {
  return {
    id,
    type: 'rect',
    comments: 'floorOpening',
    points: [
      { x: 30, y: 30 },
      { x: 50, y: 30 },
      { x: 50, y: 50 },
      { x: 30, y: 50 },
    ],
  }
}

describe('Multi-floor FDS state, coordinate alignment, persistence, and FDS combination', () => {
  beforeEach(() => {
    useStore.getState().resetProject()
    useStore.setState({
      currentMode: 'fdsGen',
      projectId: 'proj-multi',
      projectName: 'Multi-Storey Tower',
    })
  })

  it('adds floors with stacked Z levels and switches active floor cleanly', () => {
    const store = useStore.getState()
    store.setPixelsPerMesh(5)
    store.setWallHeight(3.2)
    store.setFireFloorZ(0)
    store.setOriginPixels({ x: 100, y: 200 })
    store.addElement({
      id: 0,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 100, y: 200 }, { x: 300, y: 200 }],
    })

    // Add Level 1 -> z_level should auto-stack at 0 + 3.2 = 3.2m
    useStore.getState().addFloor({ name: 'Level 1' })
    let s = useStore.getState()
    expect(s.floors).toHaveLength(2)
    expect(s.activeFloorIndex).toBe(1)
    expect(s.fireFloorZ).toBeCloseTo(3.2, 5)
    expect(s.wallHeight).toBeCloseTo(3.2, 5)
    expect(s.pixelsPerMesh).toBe(5)
    expect(s.originPixels).toEqual({ x: 100, y: 200 })
    expect(s.elements).toEqual([])

    // Draw an element on Level 1 and set a shifted origin on Level 1's PDF
    s.setOriginPixels({ x: 150, y: 250 })
    s.addElement({
      id: 0,
      type: 'rect',
      comments: 'mesh',
      points: [
        { x: 150, y: 250 },
        { x: 350, y: 250 },
        { x: 350, y: 450 },
        { x: 150, y: 450 },
      ],
    })

    // Switch back to Ground Floor (index 0)
    useStore.getState().setActiveFloor(0)
    s = useStore.getState()
    expect(s.activeFloorIndex).toBe(0)
    expect(s.fireFloorZ).toBe(0)
    expect(s.originPixels).toEqual({ x: 100, y: 200 })
    expect(s.elements).toHaveLength(1)
    expect(s.elements[0].comments).toBe('obstruction')

    // Switch back to Level 1 (index 1) -> preserves Level 1's elements & origin
    useStore.getState().setActiveFloor(1)
    s = useStore.getState()
    expect(s.activeFloorIndex).toBe(1)
    expect(s.originPixels).toEqual({ x: 150, y: 250 })
    expect(s.elements).toHaveLength(1)
    expect(s.elements[0].comments).toBe('mesh')
  })

  it('maps points and elements between floors with different origins and scales', () => {
    const groundFloor = {
      floor_number: 0,
      pixels_per_mesh: 5, // 5 px per 0.1m mesh = 50 px/m
      origin_pixels: { x: 100, y: 100 },
    }
    const firstFloor = {
      floor_number: 1,
      pixels_per_mesh: 10, // 10 px per 0.1m mesh = 100 px/m (2x higher resolution PDF)
      origin_pixels: { x: 300, y: 400 },
    }

    // A point 2m right (+100px) and 3m down (+150px) from Ground Floor's origin
    const ptGround = { x: 200, y: 250 }
    const ptFirst = mapPointBetweenFloors(ptGround, groundFloor, firstFloor)
    // On First Floor (100 px/m, origin 300,400): x = 300 + 2*100 = 500, y = 400 + 3*100 = 700
    expect(ptFirst).toEqual({ x: 500, y: 700 })

    // Transform a wall element from Ground Floor to First Floor's canvas space (for Ghost Floor rendering)
    const wall = {
      id: 1,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 100, y: 100 }, { x: 200, y: 250 }],
    }
    const ghostWall = transformElementBetweenFloors(wall, groundFloor, firstFloor)
    expect(ghostWall.points[0]).toEqual({ x: 300, y: 400 })
    expect(ghostWall.points[1]).toEqual({ x: 500, y: 700 })
  })

  it('round-trips multi-floor state through buildFdsPayload and hydrateFdsState', () => {
    const store = useStore.getState()
    store.setPixelsPerMesh(4)
    store.setWallHeight(3.0)
    store.setFireFloorZ(0)
    store.setOriginPixels({ x: 50, y: 60 })
    store.addElement({
      id: 0,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 50, y: 60 }, { x: 250, y: 60 }],
    })

    useStore.getState().addFloor({ name: 'Level 1', z_level: 3.0, wall_height: 3.5 })
    useStore.getState().setOriginPixels({ x: 80, y: 90 })
    useStore.getState().addElement({
      id: 0,
      type: 'rect',
      comments: 'floorOpening',
      points: [
        { x: 80, y: 90 },
        { x: 160, y: 90 },
        { x: 160, y: 170 },
        { x: 80, y: 170 },
      ],
    })

    const payload = buildFdsPayload(useStore.getState())
    expect(payload.floors).toHaveLength(2)
    expect(payload.floors[0].name).toBe('Fire Floor')
    expect(payload.floors[0].settings.z_level).toBe(0)
    expect(payload.floors[0].origin_pixels).toEqual({ x: 50, y: 60 })
    expect(payload.floors[0].elements).toHaveLength(1)
    expect(payload.floors[1].name).toBe('Level 1')
    expect(payload.floors[1].settings.z_level).toBe(3.0)
    expect(payload.floors[1].settings.wall_height).toBe(3.5)
    expect(payload.floors[1].origin_pixels).toEqual({ x: 80, y: 90 })
    expect(payload.floors[1].elements[0].comments).toBe('floorOpening')

    // Hydrate from server array of floors
    const hydrated = hydrateFdsState(
      { id: 'p-1', name: 'Tower', settings: payload.settings },
      payload.floors,
      useStore.getState()
    )
    expect(hydrated.floors).toHaveLength(2)
    expect(hydrated.activeFloorIndex).toBe(0)
    expect(hydrated.originPixels).toEqual({ x: 50, y: 60 })
    expect(hydrated.elements).toHaveLength(1)
    expect(hydrated.floors[1].origin_pixels).toEqual({ x: 80, y: 90 })
  })

  it('detects stale FDS signature when non-active floor is modified', () => {
    useStore.getState().addElement({
      id: 0,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    useStore.getState().addFloor({ name: 'Level 1' })
    useStore.getState().addElement({
      id: 0,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    })
    useStore.getState().captureFds('&HEAD /\n&TAIL /')
    expect(useStore.getState().isFdsStale()).toBe(false)

    // Switch to floor 0 and edit an element -> should mark FDS stale
    useStore.getState().setActiveFloor(0)
    expect(useStore.getState().isFdsStale()).toBe(false)
    useStore.getState().addElement({
      id: 1,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    })
    expect(useStore.getState().isFdsStale()).toBe(true)
  })

  it('combines multi-floor FDS strings with XY offsets, inter-floor slabs, and openings into valid 3D scene items', () => {
    const fdsFloor0 = [
      "&HEAD CHID='tower'/",
      "&TIME T_END=600.0/",
      "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,10.0,0.0,10.0,0.0,3.0/",
      "&OBST ID='Wall', XB=0.0,10.0,0.0,0.2,0.0,3.0, SURF_ID='INERT'/",
      "&TAIL /",
    ].join('\n')

    const fdsFloor1 = [
      "&HEAD CHID='tower'/",
      "&TIME T_END=600.0/",
      "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,8.0,0.0,8.0,3.0,6.0/",
      "&OBST ID='Wall', XB=0.0,8.0,0.0,0.2,3.0,6.0, SURF_ID='INERT'/",
      "&TAIL /",
    ].join('\n')

    // Floor 1 in base pixel space (basePxPerM = 100, globalMinX = 0, globalMaxY = 1000)
    const floor1ElementsInBasePx = [
      {
        id: 0,
        type: 'rect',
        comments: 'mesh',
        points: [
          { x: 100, y: 100 },
          { x: 900, y: 100 },
          { x: 900, y: 900 },
          { x: 100, y: 900 },
        ],
      },
      {
        id: 1,
        type: 'rect',
        comments: 'floorOpening',
        points: [
          { x: 300, y: 500 },
          { x: 500, y: 500 },
          { x: 500, y: 700 },
          { x: 300, y: 700 },
        ],
      },
    ]

    const slabLines = generateInterFloorSlabLines(
      floor1ElementsInBasePx,
      { floor_number: 1, name: 'Level 1', z_level: 3.0 },
      0,
      1000,
      100,
      0.2
    )

    const combined = combineMultiFloorFds([
      { floorNumber: 0, floorName: 'Ground Floor', fdsText: fdsFloor0, dx: 0, dy: 0, slabLines: [] },
      { floorNumber: 1, floorName: 'Level 1', fdsText: fdsFloor1, dx: 1.0, dy: 1.0, slabLines },
    ])

    expect(combined).toContain("&MESH ID='F0_Mesh0'")
    expect(combined).toContain("&MESH ID='F1_Mesh0'")
    expect(combined).toContain("ID='Level 1 Slab'")
    expect(combined).toContain("&HOLE ID='Floor Opening 1', XB=3,5,3,5,2.75,3.05/")
    // Only a single &HEAD and &TAIL
    expect(combined.match(/&HEAD\b/g)).toHaveLength(1)
    expect(combined.match(/&TAIL\b/g)).toHaveLength(1)

    // Verify 3D scene parser builds stacked meshes, walls, slab, and hole
    const parsed = parseFdsGeometry(combined)
    const scene = buildFdsScene(parsed)
    const meshes = scene.items.filter((i) => i.category === 'mesh')
    const obsts = scene.items.filter((i) => i.category === 'obst')
    const holes = scene.items.filter((i) => i.category === 'hole')
    expect(meshes).toHaveLength(2)
    expect(obsts.length).toBeGreaterThanOrEqual(3) // 2 walls + 1 inter-floor slab (clipped around hole)
    expect(holes).toHaveLength(1)
  })

  it('hides the Levels bar on a single floor and adds the second floor from the project-cluster + Floor button', () => {
    useStore.setState({
      currentMode: 'fdsGen',
      viewMode: '2d',
      projectId: 'proj-multi',
      projectName: 'Multi-Storey Tower',
    })

    const onSwitchFloor = vi.fn()
    const { rerender } = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AddFloorClusterButton, { onSwitchFloor }),
        React.createElement(FloorBar, { onSwitchFloor })
      )
    )

    expect(screen.queryByTestId('floor-bar')).toBeNull()
    expect(screen.queryByTestId('add-floor-button')).toBeNull()
    const clusterBtn = screen.getByTestId('add-floor-cluster-button')
    expect(clusterBtn).toBeTruthy()
    expect(clusterBtn.textContent).toMatch(/\+ Floor/)

    act(() => {
      fireEvent.click(clusterBtn)
    })
    rerender(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AddFloorClusterButton, { onSwitchFloor }),
        React.createElement(FloorBar, { onSwitchFloor })
      )
    )

    expect(useStore.getState().floors).toHaveLength(2)
    expect(useStore.getState().activeFloorIndex).toBe(1)
    expect(onSwitchFloor).toHaveBeenCalledWith(1, expect.objectContaining({ isNew: true }))
    expect(screen.getByTestId('floor-bar')).toBeTruthy()
    expect(screen.queryByTestId('add-floor-cluster-button')).toBeNull()
    expect(screen.getByTestId('add-floor-button')).toBeTruthy()
  })

  it('switches floors and restores Fire Floor elements when clicking floor tab with onSwitchFloor handler', () => {
    useStore.setState({
      currentMode: 'fdsGen',
      viewMode: '2d',
      projectId: 'proj-multi',
      projectName: 'Multi-Storey Tower',
    })

    // 1. Draw an obstruction on Floor 0 (Fire Floor)
    const store = useStore.getState()
    store.addElement({
      id: 101,
      type: 'line',
      comments: 'obstruction',
      points: [{ x: 50, y: 50 }, { x: 250, y: 50 }],
    })
    expect(useStore.getState().activeFloorIndex).toBe(0)
    expect(useStore.getState().elements).toHaveLength(1)
    expect(useStore.getState().elements[0].id).toBe(101)

    // Track onSwitchFloor calls (even if onSwitchFloor did not call setActiveFloor, FloorBar should)
    const onSwitchFloor = vi.fn()
    const onReuseGroundFloorPdf = vi.fn()

    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AddFloorClusterButton, { onSwitchFloor }),
        React.createElement(FloorBar, {
          onSwitchFloor,
          onReuseGroundFloorPdf,
        })
      )
    )

    // 2. Single-floor: no Levels bar. Cluster "+ Floor" adds Level 1 and reveals the bar.
    expect(screen.queryByTestId('floor-bar')).toBeNull()
    const clusterBtn = screen.getByTestId('add-floor-cluster-button')
    act(() => {
      fireEvent.click(clusterBtn)
    })

    expect(useStore.getState().floors).toHaveLength(2)
    expect(useStore.getState().activeFloorIndex).toBe(1)
    expect(useStore.getState().elements).toEqual([])
    expect(onSwitchFloor).toHaveBeenCalledWith(1, expect.objectContaining({ isNew: true }))

    // Draw a floor opening on Level 1
    act(() => {
      useStore.getState().addElement({
        id: 201,
        type: 'rect',
        comments: 'floorOpening',
        points: [
          { x: 10, y: 10 },
          { x: 80, y: 10 },
          { x: 80, y: 80 },
          { x: 10, y: 80 },
        ],
      })
    })
    expect(useStore.getState().elements).toHaveLength(1)
    expect(useStore.getState().elements[0].id).toBe(201)

    // Level 1 starts with a blank drafting sheet banner and reuse button
    expect(screen.getByTestId('drafting-sheet-banner')).toBeTruthy()
    const reuseBtn = screen.getByTestId('banner-reuse-ground-pdf-button')
    expect(reuseBtn).toBeTruthy()
    act(() => {
      fireEvent.click(reuseBtn)
    })
    expect(onReuseGroundFloorPdf).toHaveBeenCalledWith(1)

    // 3. Click floor-tab-0 ("Fire Floor") -> updates activeFloorIndex back to 0
    // and restores Fire Floor's elements
    const floorTab0 = screen.getByTestId('floor-tab-0')
    act(() => {
      fireEvent.click(floorTab0)
    })

    expect(onSwitchFloor).toHaveBeenCalledWith(0, expect.anything())
    expect(useStore.getState().activeFloorIndex).toBe(0)
    expect(useStore.getState().elements).toHaveLength(1)
    expect(useStore.getState().elements[0].id).toBe(101)
    expect(useStore.getState().elements[0].comments).toBe('obstruction')

    // 4. Click floor-tab-1 ("Floor 1") -> switches back to Level 1 and restores its elements
    const floorTab1 = screen.getByTestId('floor-tab-1')
    act(() => {
      fireEvent.click(floorTab1)
    })

    expect(useStore.getState().activeFloorIndex).toBe(1)
    expect(useStore.getState().elements).toHaveLength(1)
    expect(useStore.getState().elements[0].id).toBe(201)
    expect(useStore.getState().elements[0].comments).toBe('floorOpening')
  })

  it('validates mesh existence before calling backend in generateFdsCode', async () => {
    // 1. With 0 elements across all floors, generateFdsCode rejects clearly
    await expect(generateFdsCode({ download: false })).rejects.toThrow(
      /Please draw at least one Mesh on your floor plan before generating FDS/
    )

    // 2. With walls but NO mesh, generateFdsCode rejects clearly
    useStore.getState().addElement({
      id: 1,
      type: 'polyline',
      comments: 'obstruction',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    await expect(generateFdsCode({ download: false })).rejects.toThrow(
      /FDS requires at least one computational Mesh domain/
    )
  })

  it('POSTs two floors to live /fds and combines stacked meshes into one file', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', RAILWAY_DEV_API)

    useStore.setState({
      currentMode: 'fdsGen',
      viewMode: '2d',
      pixelsPerMesh: 1,
      wallHeight: 3,
      fireFloorZ: 0,
      originPixels: { x: 0, y: 0 },
      totalFloors: 2,
      isSprinklered: false,
      includeSensors: false,
      simEndTime: 30,
      doorLeakagesEnabled: false,
    })

    useStore.getState().addElement(meshRect(1))
    useStore.getState().addElement(wallLine(2))
    useStore.getState().addFloor({ name: 'Level 1' })
    useStore.getState().addElement(meshRect(1))
    useStore.getState().addElement(wallLine(2))
    useStore.getState().addElement(openingRect(3))

    const combined = await generateFdsCode({ download: false })
    expect(typeof combined).toBe('string')
    expect(combined.length).toBeGreaterThan(200)

    mkdirSync(FDS_OUTPUT_DIR, { recursive: true })
    const outPath = path.join(FDS_OUTPUT_DIR, 'two-floor-live.fds')
    writeFileSync(outPath, combined)

    expect(combined.match(/&HEAD\b/g)).toHaveLength(1)
    expect(combined.match(/&TAIL\b/g)).toHaveLength(1)
    expect(combined).toMatch(/&MESH ID='F0_/)
    expect(combined).toMatch(/&MESH ID='F1_/)

    const meshLines = combined.split(/\r?\n/).filter((l) => l.trim().toUpperCase().startsWith('&MESH'))
    expect(meshLines.length).toBeGreaterThanOrEqual(2)

    const parseXb = (line) => {
      const m = line.match(/XB=([^/]+)/i)
      expect(m).toBeTruthy()
      return m[1].split(',').map(Number)
    }
    const zRanges = meshLines.map((line) => {
      const xb = parseXb(line)
      return { zmin: xb[4], zmax: xb[5] }
    })
    const zMins = zRanges.map((z) => z.zmin)
    expect(Math.min(...zMins)).toBeCloseTo(0, 1)
    expect(Math.max(...zMins)).toBeGreaterThan(2)

    expect(combined).toMatch(/Slab/)
    expect(combined).toMatch(/&HOLE /)

    const parsed = parseFdsGeometry(combined)
    const scene = buildFdsScene(parsed)
    const meshes = scene.items.filter((i) => i.category === 'mesh')
    expect(meshes.length).toBeGreaterThanOrEqual(2)

    expect(useStore.getState().fdsCode).toBe(combined)
  }, 60000)

  it('keeps floor-by-floor mesh sizes and snaps only the overlap to a shared cell grid', () => {
    const fdsFloor0 = [
      "&HEAD CHID='tower'/",
      "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,10.0,0.0,10.0,0.0,3.0/",
      "&OBST ID='Wall', XB=0.0,10.0,0.0,0.2,0.0,3.0, SURF_ID='INERT'/",
      "&TAIL /",
    ].join('\n')
    const fdsFloor1 = [
      "&HEAD CHID='tower'/",
      "&MESH ID='Mesh0', IJK=10,10,6, XB=0.0,8.0,0.0,8.0,3.0,6.0/",
      "&OBST ID='Wall', XB=0.0,8.0,0.0,0.2,3.0,6.0, SURF_ID='INERT'/",
      "&TAIL /",
    ].join('\n')
    const runs = [
      { floorNumber: 0, floorName: 'Ground Floor', fdsText: fdsFloor0, dx: 0, dy: 0, slabLines: [] },
      { floorNumber: 1, floorName: 'Level 1', fdsText: fdsFloor1, dx: 1.0, dy: 1.0, slabLines: [] },
    ]

    const misaligned = combineMultiFloorFds(runs, { alignStackedMeshes: false })
    const before = parseMeshTable(misaligned)
    expect(before).toHaveLength(2)
    const before0 = before.find((m) => m.id.startsWith('F0_'))
    const before1 = before.find((m) => m.id.startsWith('F1_'))
    // Independent combine: larger ground 0–10, inset upper 1–9, but 0.8 m vs 1 m cells.
    expect(before0.xmax - before0.xmin).toBeGreaterThan(before1.xmax - before1.xmin)
    expect((before1.xmax - before1.xmin) / before1.i).not.toBeCloseTo(
      (before0.xmax - before0.xmin) / before0.i,
      5
    )

    mkdirSync(ALIGN_DIR, { recursive: true })
    writeFileSync(path.join(ALIGN_DIR, 'misaligned-before.fds'), misaligned)

    const aligned = combineMultiFloorFds(runs)
    const meshes = parseMeshTable(aligned)
    expect(meshes).toHaveLength(2)
    const f0 = meshes.find((m) => m.id.startsWith('F0_'))
    const f1 = meshes.find((m) => m.id.startsWith('F1_'))
    const cell0 = (f0.xmax - f0.xmin) / f0.i
    const cell1 = (f1.xmax - f1.xmin) / f1.i
    expect(f0.xmax - f0.xmin).toBeGreaterThan(f1.xmax - f1.xmin)
    expect(f0.ymax - f0.ymin).toBeGreaterThan(f1.ymax - f1.ymin)
    expect(f0.xmin).not.toBeCloseTo(f1.xmin, 5)
    expect(f0.xmax).not.toBeCloseTo(f1.xmax, 5)
    expect(cell1).toBeCloseTo(cell0, 5)
    expect((f1.xmin - f0.xmin) / cell0).toBeCloseTo(Math.round((f1.xmin - f0.xmin) / cell0), 5)
    expect((f1.xmax - f0.xmin) / cell0).toBeCloseTo(Math.round((f1.xmax - f0.xmin) / cell0), 5)
    expect(f1.xmin).toBeGreaterThanOrEqual(f0.xmin - 1e-6)
    expect(f1.xmax).toBeLessThanOrEqual(f0.xmax + 1e-6)
    expect(f0.zmax).toBeCloseTo(f1.zmin, 5)
    expect(aligned.match(/&HEAD\b/g)).toHaveLength(1)
    expect(aligned.match(/&TAIL\b/g)).toHaveLength(1)

    writeFileSync(path.join(ALIGN_DIR, 'aligned-after.fds'), aligned)
    const table = [
      'id\tIJK\tXB',
      ...meshes.map((m) => `${m.id}\t${m.i},${m.j},${m.k}\t${m.xmin},${m.xmax},${m.ymin},${m.ymax},${m.zmin},${m.zmax}`),
    ].join('\n')
    writeFileSync(path.join(ALIGN_DIR, 'mesh-xb-ijk.txt'), `${table}\n`)
  })

  it('live /fds: larger ground mesh can stick out; upper stays smaller and overlap sits on the cell grid', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', RAILWAY_DEV_API)

    useStore.setState({
      currentMode: 'fdsGen',
      viewMode: '2d',
      pixelsPerMesh: 1,
      wallHeight: 3,
      fireFloorZ: 0,
      originPixels: { x: 0, y: 0 },
      totalFloors: 2,
      isSprinklered: false,
      includeSensors: false,
      simEndTime: 30,
      doorLeakagesEnabled: false,
    })

    useStore.getState().addElement({
      id: 1,
      type: 'rect',
      comments: 'mesh',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    })
    useStore.getState().addElement(wallLine(2, 100))
    useStore.getState().addFloor({ name: 'Level 1' })
    useStore.getState().addElement({
      id: 1,
      type: 'rect',
      comments: 'mesh',
      points: [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
        { x: 20, y: 80 },
      ],
    })
    useStore.getState().addElement({
      id: 2,
      type: 'polyline',
      comments: 'obstruction',
      points: [{ x: 20, y: 20 }, { x: 80, y: 20 }],
    })
    useStore.getState().addElement(openingRect(3))

    const combined = await generateFdsCode({ download: false })
    const meshes = parseMeshTable(combined)
    const f0 = meshes.find((m) => m.id.startsWith('F0_'))
    const f1 = meshes.find((m) => m.id.startsWith('F1_'))
    expect(f0).toBeTruthy()
    expect(f1).toBeTruthy()
    const cell0 = (f0.xmax - f0.xmin) / f0.i
    const cell1 = (f1.xmax - f1.xmin) / f1.i
    expect(f0.xmax - f0.xmin).toBeGreaterThan(f1.xmax - f1.xmin)
    expect(f0.i).not.toBe(f1.i)
    expect(cell1).toBeCloseTo(cell0, 5)
    expect((f1.xmin - f0.xmin) / cell0).toBeCloseTo(Math.round((f1.xmin - f0.xmin) / cell0), 5)
    expect((f1.xmax - f0.xmin) / cell0).toBeCloseTo(Math.round((f1.xmax - f0.xmin) / cell0), 5)
    expect(Math.min(f0.zmin, f1.zmin)).toBeCloseTo(0, 1)
    expect(Math.max(f0.zmin, f1.zmin)).toBeGreaterThan(2)

    mkdirSync(ALIGN_DIR, { recursive: true })
    writeFileSync(path.join(ALIGN_DIR, 'aligned-live.fds'), combined)
  }, 60000)

  it('emits a 0.2 m concrete slab over the floor-join overlap and cuts the stair void', () => {
    const SLAB_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/inter-floor-slabs'
    // Upper mesh is larger (0–10 m) than ground (2–8 m). Slab must be the overlap,
    // not the union and not the full upper footprint.
    const groundEls = [
      {
        id: 1,
        type: 'rect',
        comments: 'mesh',
        points: [
          { x: 20, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 80 },
          { x: 20, y: 80 },
        ],
      },
    ]
    const upperEls = [
      {
        id: 1,
        type: 'rect',
        comments: 'mesh',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      },
      {
        id: 2,
        type: 'rect',
        comments: 'stairMesh',
        points: [
          { x: 40, y: 40 },
          { x: 55, y: 40 },
          { x: 55, y: 70 },
          { x: 40, y: 70 },
        ],
      },
    ]

    const lines = generateInterFloorSlabLines(
      upperEls,
      { floor_number: 1, name: 'Level 1', z_level: 3.0 },
      0,
      100,
      10,
      undefined,
      groundEls
    )
    const obst = lines.find((l) => /^\s*&OBST\b/i.test(l))
    const hole = lines.find((l) => /^\s*&HOLE\b/i.test(l))
    expect(obst).toBeTruthy()
    expect(hole).toBeTruthy()
    expect(obst).toMatch(/SURF_ID='Concrete'/i)
    expect(obst).not.toMatch(/Plasterboard/i)

    const xb = obst.match(/XB=\s*([^/]+)/i)[1].split(',').map(Number)
    const [x1, x2, y1, y2, z1, z2] = xb
    expect(z2 - z1).toBeCloseTo(0.2, 5)
    expect(z2).toBeCloseTo(3.0, 5)
    expect(x2 - x1).toBeCloseTo(6, 1)
    expect(y2 - y1).toBeCloseTo(6, 1)
    expect(x1).toBeGreaterThanOrEqual(1.9)
    expect(x2).toBeLessThanOrEqual(8.1)

    const hxb = hole.match(/XB=\s*([^/]+)/i)[1].split(',').map(Number)
    expect(hxb[0]).toBeGreaterThanOrEqual(3.9)
    expect(hxb[1]).toBeLessThanOrEqual(5.6)
    expect(hxb[4]).toBeLessThan(z1)
    expect(hxb[5]).toBeGreaterThan(z2)

    const combined = combineMultiFloorFds([
      {
        floorNumber: 0,
        fdsText: "&HEAD CHID='tower'/\n&MESH ID='Mesh0', IJK=10,10,6, XB=0,10,0,10,0,3/\n&TAIL /",
        dx: 0,
        dy: 0,
        slabLines: [],
      },
      {
        floorNumber: 1,
        fdsText: "&HEAD CHID='tower'/\n&MESH ID='Mesh0', IJK=10,10,6, XB=0,10,0,10,3,6/\n&TAIL /",
        dx: 0,
        dy: 0,
        slabLines: lines,
      },
    ])
    expect(combined).toMatch(/SURF_ID='Concrete'/i)
    expect(combined).toMatch(/&SURF\b[^/]*ID='Concrete'/i)
    expect(combined).toMatch(/&HOLE /)
    expect(combined.match(/&MESH\b/g).length).toBe(2)

    mkdirSync(SLAB_DIR, { recursive: true })
    writeFileSync(path.join(SLAB_DIR, 'slab-join.fds'), combined)
    writeFileSync(
      path.join(SLAB_DIR, 'slab-obst-hole.txt'),
      lines.filter((l) => /^\s*&OBST\b|^\s*&HOLE\b/i.test(l)).join('\n') + '\n'
    )
  })

  it('live /fds: 0.2 m concrete join slab matches the smaller upper overlap and is cut at the stair', async () => {
    const SLAB_DIR = '/cursor/stores/bc-ba8cf0f9-ea7f-5db3-ae81-ac8a639e9b4d/media/inter-floor-slabs'
    vi.stubEnv('NEXT_PUBLIC_API_URL', RAILWAY_DEV_API)

    useStore.setState({
      currentMode: 'fdsGen',
      viewMode: '2d',
      pixelsPerMesh: 1,
      wallHeight: 3,
      fireFloorZ: 0,
      originPixels: { x: 0, y: 0 },
      totalFloors: 2,
      isSprinklered: false,
      includeSensors: false,
      simEndTime: 30,
      doorLeakagesEnabled: false,
    })

    useStore.getState().addElement({
      id: 1,
      type: 'rect',
      comments: 'mesh',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    })
    useStore.getState().addElement(wallLine(2, 100))
    useStore.getState().addFloor({ name: 'Level 1' })
    useStore.getState().addElement({
      id: 1,
      type: 'rect',
      comments: 'mesh',
      points: [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
        { x: 20, y: 80 },
      ],
    })
    useStore.getState().addElement({
      id: 2,
      type: 'polyline',
      comments: 'obstruction',
      points: [{ x: 20, y: 20 }, { x: 80, y: 20 }],
    })
    useStore.getState().addElement({
      id: 3,
      type: 'rect',
      comments: 'stairMesh',
      points: [
        { x: 40, y: 40 },
        { x: 55, y: 40 },
        { x: 55, y: 70 },
        { x: 40, y: 70 },
      ],
    })

    const combined = await generateFdsCode({ download: false })
    const slab = (combined.split(/\r?\n/).find((l) => /Slab/i.test(l) && /^\s*&OBST\b/i.test(l))) || ''
    const hole = (combined.split(/\r?\n/).find((l) => /^\s*&HOLE\b/i.test(l))) || ''
    expect(slab).toMatch(/SURF_ID='Concrete'/i)
    expect(slab).not.toMatch(/Plasterboard/i)
    const sxb = slab.match(/XB=\s*([^/]+)/i)[1].split(',').map(Number)
    expect(sxb[5] - sxb[4]).toBeCloseTo(0.2, 5)
    const meshes = parseMeshTable(combined)
    const f0 = meshes.find((m) => m.id.startsWith('F0_'))
    const f1 = meshes.find((m) => m.id.startsWith('F1_'))
    expect(f0.xmax - f0.xmin).toBeGreaterThan(f1.xmax - f1.xmin)
    expect(sxb[1] - sxb[0]).toBeLessThanOrEqual((f1.xmax - f1.xmin) + 0.15)
    expect(sxb[1] - sxb[0]).toBeLessThan(f0.xmax - f0.xmin)
    expect(hole).toMatch(/&HOLE /)
    expect(combined).toMatch(/&SURF\b[\s\S]*?ID='Concrete'/i)

    mkdirSync(SLAB_DIR, { recursive: true })
    writeFileSync(path.join(SLAB_DIR, 'slab-live.fds'), combined)
    writeFileSync(
      path.join(SLAB_DIR, 'slab-obst-hole.txt'),
      [slab, hole].join('\n') + '\n'
    )
  }, 60000)
})
