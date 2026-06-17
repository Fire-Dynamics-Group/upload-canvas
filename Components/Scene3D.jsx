import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { parseFdsGeometry, summarizeFds } from '../utils/fdsParse'
import { buildFdsScene } from '../utils/fdsScene'

// Read-only 3D view of the geometry described by an FDS file. We parse the FDS
// text (ground truth — what the solver will actually run) and draw each
// OBST/MESH/VENT/HOLE box and DEVC marker. This is the "verify" view: it is NOT
// a re-extrusion of the 2D drawing, so a mismatch here is a real divergence
// between intent and generated input.
//
// FDS is Z-up; three.js is Y-up. We map FDS (x, y, z) -> three (x, z, -y).
const toThree = (x, y, z) => [x, z, -y]

const CATEGORY_ORDER = ['mesh', 'obst', 'fire', 'door', 'doorLeak', 'vent', 'domainVent', 'hole', 'device']
const CATEGORY_LABEL = {
    mesh: 'Meshes', obst: 'Obstructions', fire: 'Fire', door: 'Doors', doorLeak: 'Door leaks',
    vent: 'Vents', domainVent: 'Domain vents', hole: 'Holes', device: 'Devices',
}
// Domain (mesh-boundary) vents box the model in, so they're off by default.
const defaultVisible = (cat) => cat !== 'domainVent'

const hexCss = (n) => '#' + n.toString(16).padStart(6, '0')

// Billboarded text label drawn to a canvas texture. depthTest:false so labels
// read through transparent walls (a verification view wants names visible).
function makeLabelSprite(text) {
    const font = 44, padX = 10, padY = 6
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = `${font}px sans-serif`
    const tw = Math.ceil(ctx.measureText(text).width)
    canvas.width = tw + padX * 2
    canvas.height = font + padY * 2
    ctx.font = `${font}px sans-serif`           // resizing the canvas resets the context
    ctx.fillStyle = 'rgba(17,19,24,0.82)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, padX, canvas.height / 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
    const s = 0.011 // world metres per canvas px
    sprite.scale.set(canvas.width * s, canvas.height * s, 1)
    sprite.renderOrder = 999
    return sprite
}

export default function Scene3D({ fdsCode }) {
    const mountRef = useRef(null)
    const apiRef = useRef(null)       // { frameAll, topDown, frameFire }
    const groupsRef = useRef({})      // category -> THREE.Group (+ q:<quantity> subgroups)
    const obstMatsRef = useRef([])    // [{ mat, baseOpacity }]

    // Parse once per fdsCode; drives both the render and the panel.
    const built = useMemo(() => buildFdsScene(parseFdsGeometry(fdsCode)), [fdsCode])
    const counts = useMemo(() => summarizeFds(parseFdsGeometry(fdsCode)), [fdsCode])
    const categoriesPresent = useMemo(
        () => CATEGORY_ORDER.filter((c) => built.items.some((it) => it.category === c)),
        [built],
    )

    const initLayers = (b) => {
        const l = {}
        CATEGORY_ORDER.forEach((c) => { l[c] = defaultVisible(c) })
        b.quantities.forEach((q) => { l[`q:${q}`] = true })
        return l
    }
    const [layers, setLayers] = useState(() => initLayers(built))
    const [xray, setXray] = useState(false)
    const [showLabels, setShowLabels] = useState(true)
    const layersRef = useRef(layers)
    layersRef.current = layers
    const showLabelsRef = useRef(showLabels)
    showLabelsRef.current = showLabels

    // Reset panel state when the geometry changes.
    useEffect(() => { setLayers(initLayers(built)); setXray(false); setShowLabels(true) }, [built])

    // --- Build the three.js scene (rebuilds when geometry changes) ---
    useEffect(() => {
        const mount = mountRef.current
        if (!mount) return
        const { items, bounds } = built

        const width = mount.clientWidth || 800
        const height = mount.clientHeight || 600

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x2b2f3a)

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 5000)
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height)
        renderer.autoClear = true
        mount.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true

        scene.add(new THREE.AmbientLight(0xffffff, 0.8))
        const dir = new THREE.DirectionalLight(0xffffff, 0.85)
        dir.position.set(1, 2, 1.5)
        scene.add(dir)

        const span = bounds ? Math.max(bounds.size[0], bounds.size[1], 4) : 10
        const grid = new THREE.GridHelper(Math.ceil(span * 1.5), Math.ceil(span * 1.5), 0x55607a, 0x3a4154)
        if (bounds) grid.position.set(bounds.center[0], 0, -bounds.center[1])
        scene.add(grid)

        // Category groups (+ per-quantity subgroups under the device group).
        const groups = {}
        CATEGORY_ORDER.forEach((c) => { groups[c] = new THREE.Group(); scene.add(groups[c]) })
        const obstMats = []
        const boxGeo = new THREE.BoxGeometry(1, 1, 1)
        const edgeGeo = new THREE.EdgesGeometry(boxGeo)

        const addBoxTo = (group, it) => {
            const [tx, ty, tz] = toThree(it.center[0], it.center[1], it.center[2])
            const sx = it.size[0], sy = it.size[2], sz = it.size[1] // FDS (x,y,z) -> three (x,z,y-as-z)
            if (it.wireframe) {
                const line = new THREE.LineSegments(
                    edgeGeo.clone(),
                    new THREE.LineBasicMaterial({ color: it.color, transparent: it.opacity < 1, opacity: it.opacity }),
                )
                line.position.set(tx, ty, tz); line.scale.set(sx, sy, sz)
                group.add(line)
            } else {
                const mat = new THREE.MeshStandardMaterial({
                    color: it.color,
                    transparent: it.opacity < 1 || Boolean(it.overlay),
                    opacity: it.opacity,
                    depthWrite: it.opacity >= 1 && !it.overlay, // transparent walls don't fight each other
                    depthTest: !it.overlay,                     // overlays (door leaks) draw on top
                    roughness: 0.85, metalness: 0.0,
                    emissive: it.emissive ? it.color : 0x000000,
                    emissiveIntensity: it.emissive ? 0.4 : 0,
                })
                if (it.category === 'obst') obstMats.push({ mat, baseOpacity: it.baseOpacity })
                const mesh = new THREE.Mesh(boxGeo, mat)
                mesh.position.set(tx, ty, tz); mesh.scale.set(sx, sy, sz)
                if (it.overlay) mesh.renderOrder = 6
                group.add(mesh)
                const outline = new THREE.LineSegments(
                    edgeGeo.clone(),
                    new THREE.LineBasicMaterial({ color: 0x1c2026, transparent: true, opacity: 0.3 }),
                )
                outline.position.set(tx, ty, tz); outline.scale.set(sx, sy, sz)
                group.add(outline)
            }
        }

        const fireBox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
        for (const it of items) {
            if (it.category === 'device') {
                const q = (it.quantity || 'OTHER').toUpperCase()
                const key = `q:${q}`
                if (!groups[key]) { groups[key] = new THREE.Group(); groups.device.add(groups[key]) }
                addBoxTo(groups[key], it)
            } else {
                addBoxTo(groups[it.category], it)
                if (it.category === 'fire') {
                    for (let a = 0; a < 3; a++) {
                        fireBox.min[a] = Math.min(fireBox.min[a], it.center[a] - it.size[a] / 2)
                        fireBox.max[a] = Math.max(fireBox.max[a], it.center[a] + it.size[a] / 2)
                    }
                }
            }
        }
        // Floating labels for the human-named elements (doors, fire, dampers,
        // extracts, inlets) — carried straight from the FDS `ID`s.
        const labelGroup = new THREE.Group()
        labelGroup.visible = showLabelsRef.current
        scene.add(labelGroup)
        for (const it of items) {
            if (!it.named || !it.label) continue
            const [lx, ly, lz] = toThree(it.center[0], it.center[1], it.center[2])
            const sprite = makeLabelSprite(it.label)
            sprite.position.set(lx, ly + it.size[2] / 2 + 0.25, lz)
            labelGroup.add(sprite)
        }
        groups.labels = labelGroup

        groupsRef.current = groups
        obstMatsRef.current = obstMats

        // --- Camera framing helpers ---
        const place = (targetFds, distance, isoDir = [1.2, 1.1, 1.4]) => {
            const [cx, cy, cz] = toThree(targetFds[0], targetFds[1], targetFds[2])
            controls.target.set(cx, cy, cz)
            camera.position.set(cx + distance * isoDir[0], cy + distance * isoDir[1], cz + distance * isoDir[2])
            camera.up.set(0, 1, 0)
            camera.lookAt(controls.target); controls.update()
        }
        const frameAll = () => {
            if (!bounds) { place([0, 0, 0], 8); return }
            place(bounds.center, Math.max(...bounds.size, 2) * 1.1)
        }
        const topDown = () => {
            const c = bounds ? bounds.center : [0, 0, 0]
            const [cx, cy, cz] = toThree(c[0], c[1], c[2])
            const d = bounds ? Math.max(...bounds.size, 4) : 12
            // Keep WORLD up (0,1,0) so OrbitControls can still orbit — a custom
            // up + straight-down view hits the gimbal pole and locks rotation.
            // Steep bird's-eye from the south reads as a plan (north up, east
            // right) without being dead-vertical.
            camera.up.set(0, 1, 0)
            controls.target.set(cx, cy, cz)
            camera.position.set(cx, cy + d * 1.7, cz + d * 0.55)
            camera.lookAt(controls.target); controls.update()
        }
        const frameFire = () => {
            if (fireBox.min[0] === Infinity) { frameAll(); return }
            const center = [0, 1, 2].map((a) => (fireBox.min[a] + fireBox.max[a]) / 2)
            const size = [0, 1, 2].map((a) => fireBox.max[a] - fireBox.min[a])
            place(center, Math.max(...size, 1.5) * 2.2)
        }
        apiRef.current = { frameAll, topDown, frameFire }
        // Default to top-down so the 3D directly overlays the 2D plan
        // (north-up, east-right). "Frame" gives the iso 3/4 when you want depth.
        topDown()

        // --- Corner orientation gizmo (axes triad mirroring the camera) ---
        const gizmoScene = new THREE.Scene()
        const gizmoCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10)
        gizmoCam.position.set(0, 0, 4)
        const gizmoAxes = new THREE.AxesHelper(1.2)
        gizmoScene.add(gizmoAxes)

        // Apply current panel state to the freshly built groups.
        const syncVisibility = () => {
            const L = layersRef.current
            CATEGORY_ORDER.forEach((c) => { if (groups[c]) groups[c].visible = L[c] })
            Object.keys(groups).forEach((k) => {
                if (k.startsWith('q:')) groups[k].visible = L[k] !== false
            })
        }
        syncVisibility()

        let raf
        const animate = () => {
            raf = requestAnimationFrame(animate)
            controls.update()
            renderer.setViewport(0, 0, mount.clientWidth, mount.clientHeight)
            renderer.render(scene, camera)
            // gizmo overlay, bottom-left
            const gs = 96
            renderer.clearDepth()
            renderer.setScissorTest(true)
            renderer.setScissor(10, 10, gs, gs)
            renderer.setViewport(10, 10, gs, gs)
            gizmoAxes.quaternion.copy(camera.quaternion).invert()
            renderer.render(gizmoScene, gizmoCam)
            renderer.setScissorTest(false)
        }
        animate()

        const onResize = () => {
            const w = mount.clientWidth, h = mount.clientHeight
            if (!w || !h) return
            camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(mount)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            controls.dispose()
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
                mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose() })
            })
            boxGeo.dispose(); edgeGeo.dispose()
            renderer.dispose()
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
            apiRef.current = null; groupsRef.current = {}; obstMatsRef.current = []
        }
    }, [built])

    // Sync group visibility when the panel changes.
    useEffect(() => {
        const groups = groupsRef.current
        CATEGORY_ORDER.forEach((c) => { if (groups[c]) groups[c].visible = layers[c] })
        Object.keys(groups).forEach((k) => {
            if (k.startsWith('q:')) groups[k].visible = layers[k] !== false
        })
    }, [layers])

    // Toggle the floating-label group.
    useEffect(() => {
        const g = groupsRef.current.labels
        if (g) g.visible = showLabels
    }, [showLabels])

    // X-ray walls: drop obstruction opacity without losing the FDS value.
    useEffect(() => {
        obstMatsRef.current.forEach(({ mat, baseOpacity }) => {
            const op = xray ? Math.min(baseOpacity, 0.1) : baseOpacity
            mat.opacity = op
            mat.transparent = op < 1
            mat.depthWrite = op >= 1
            mat.needsUpdate = true
        })
    }, [xray])

    const total = counts.meshes + counts.obsts + counts.vents + counts.holes + counts.devices
    const toggle = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }))
    const swatch = (cat) => {
        const it = built.items.find((i) => i.category === cat)
        return it ? hexCss(it.color) : '#888'
    }

    return (
        <div className="absolute inset-0">
            <div ref={mountRef} className="w-full h-full" />

            {total === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-300 text-sm">No geometry found in the FDS file.</p>
                </div>
            )}

            {/* Visibility panel (PyroSim-style) */}
            <div className="absolute top-3 right-3 w-52 text-[12px] text-gray-200 bg-gray-900/85 rounded-md border border-gray-700 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                    <span className="font-medium">Layers</span>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer text-gray-300">
                            <input type="checkbox" checked={showLabels} onChange={() => setShowLabels((v) => !v)} />
                            Labels
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer text-gray-300">
                            <input type="checkbox" checked={xray} onChange={() => setXray((v) => !v)} />
                            X-ray
                        </label>
                    </div>
                </div>
                <div className="px-2 py-2 space-y-1 max-h-[50vh] overflow-auto">
                    {categoriesPresent.map((cat) => (
                        <div key={cat}>
                            <label className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-white/5">
                                <input type="checkbox" checked={!!layers[cat]} onChange={() => toggle(cat)} />
                                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: swatch(cat) }} />
                                <span>{CATEGORY_LABEL[cat]}</span>
                            </label>
                            {cat === 'device' && built.quantities.length > 1 && (
                                <div className="pl-7 space-y-0.5">
                                    {built.quantities.map((q) => {
                                        const di = built.items.find((i) => i.category === 'device' && (i.quantity || 'OTHER').toUpperCase() === q)
                                        return (
                                            <label key={q} className="flex items-center gap-2 cursor-pointer text-gray-400 text-[11px]">
                                                <input
                                                    type="checkbox"
                                                    checked={layers[`q:${q}`] !== false}
                                                    onChange={() => toggle(`q:${q}`)}
                                                />
                                                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: di ? hexCss(di.color) : '#888' }} />
                                                <span>{q.toLowerCase()}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Camera presets */}
            <div className="absolute top-3 left-3 flex gap-1">
                {[['Frame', 'frameAll'], ['Top', 'topDown'], ['Fire', 'frameFire']].map(([label, fn]) => (
                    <button
                        key={fn}
                        type="button"
                        onClick={() => apiRef.current?.[fn]?.()}
                        className="text-[11px] px-2 py-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-200 border border-gray-700"
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="absolute bottom-3 right-3 text-[11px] text-gray-400 pointer-events-none">
                drag orbit · scroll zoom · right-drag pan
            </div>
        </div>
    )
}
