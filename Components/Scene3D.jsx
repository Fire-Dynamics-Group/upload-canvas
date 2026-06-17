import { useEffect, useRef } from 'react'
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

export default function Scene3D({ fdsCode }) {
    const mountRef = useRef(null)

    useEffect(() => {
        const mount = mountRef.current
        if (!mount) return

        const parsed = parseFdsGeometry(fdsCode)
        const { items, bounds } = buildFdsScene(parsed)

        const width = mount.clientWidth || 800
        const height = mount.clientHeight || 600

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x2b2f3a)

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 5000)
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height)
        mount.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.75))
        const dir = new THREE.DirectionalLight(0xffffff, 0.9)
        dir.position.set(1, 2, 1.5)
        scene.add(dir)

        // Ground grid + axes sized to the domain (fallback to a default span).
        const span = bounds ? Math.max(bounds.size[0], bounds.size[1], 4) : 10
        const grid = new THREE.GridHelper(Math.ceil(span * 1.5), Math.ceil(span * 1.5), 0x55607a, 0x3a4154)
        if (bounds) grid.position.set(bounds.center[0], 0, -bounds.center[1])
        scene.add(grid)
        scene.add(new THREE.AxesHelper(Math.max(1, span * 0.15)))

        // Build meshes
        const boxGeo = new THREE.BoxGeometry(1, 1, 1)
        for (const it of items) {
            const [tx, ty, tz] = toThree(it.center[0], it.center[1], it.center[2])
            // FDS size (sx,sy,sz) -> three (sx, sz, sy)
            const sx = it.size[0], sy = it.size[2], sz = it.size[1]

            if (it.wireframe) {
                const edges = new THREE.EdgesGeometry(boxGeo)
                const line = new THREE.LineSegments(
                    edges,
                    new THREE.LineBasicMaterial({ color: it.color, transparent: it.opacity < 1, opacity: it.opacity }),
                )
                line.position.set(tx, ty, tz)
                line.scale.set(sx, sy, sz)
                scene.add(line)
            } else {
                const mat = new THREE.MeshStandardMaterial({
                    color: it.color,
                    transparent: it.opacity < 1,
                    opacity: it.opacity,
                    roughness: 0.85,
                    metalness: 0.0,
                })
                const mesh = new THREE.Mesh(boxGeo, mat)
                mesh.position.set(tx, ty, tz)
                mesh.scale.set(sx, sy, sz)
                scene.add(mesh)
                // Crisp outline so abutting boxes stay readable.
                const outline = new THREE.LineSegments(
                    new THREE.EdgesGeometry(boxGeo),
                    new THREE.LineBasicMaterial({ color: 0x1c2026, transparent: true, opacity: 0.35 }),
                )
                outline.position.set(tx, ty, tz)
                outline.scale.set(sx, sy, sz)
                scene.add(outline)
            }
        }

        // Frame the camera on the domain.
        if (bounds) {
            const [cx, cy, cz] = toThree(bounds.center[0], bounds.center[1], bounds.center[2])
            const radius = Math.max(...bounds.size, 2)
            controls.target.set(cx, cy, cz)
            camera.position.set(cx + radius * 1.2, cz + radius * 1.1, -cy + radius * 1.4)
        } else {
            camera.position.set(8, 8, 8)
        }
        camera.lookAt(controls.target)
        controls.update()

        let raf
        const animate = () => {
            raf = requestAnimationFrame(animate)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()

        const onResize = () => {
            const w = mount.clientWidth, h = mount.clientHeight
            if (!w || !h) return
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            renderer.setSize(w, h)
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(mount)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            controls.dispose()
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose()
            })
            boxGeo.dispose()
            renderer.dispose()
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
        }
    }, [fdsCode])

    const counts = summarizeFds(parseFdsGeometry(fdsCode))
    const total = counts.meshes + counts.obsts + counts.vents + counts.holes + counts.devices

    return (
        <div className="absolute inset-0">
            <div ref={mountRef} className="w-full h-full" />
            {total === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-300 text-sm">No geometry found in the FDS file.</p>
                </div>
            )}
            <div className="absolute top-3 left-3 text-[11px] text-gray-200 bg-black/40 rounded px-2 py-1 leading-5 pointer-events-none">
                <div><span className="text-gray-400">meshes</span> {counts.meshes}</div>
                <div><span className="text-gray-400">obstructions</span> {counts.obsts}</div>
                <div><span className="text-gray-400">vents</span> {counts.vents} · <span className="text-gray-400">holes</span> {counts.holes}</div>
                <div><span className="text-gray-400">devices</span> {counts.devices}</div>
            </div>
            <div className="absolute bottom-3 left-3 text-[11px] text-gray-400 pointer-events-none">
                drag to orbit · scroll to zoom · right-drag to pan
            </div>
        </div>
    )
}
