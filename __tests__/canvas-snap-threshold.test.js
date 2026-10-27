import { describe, it, expect } from 'vitest'
import { canvasSnapThreshold, SNAP_SCREEN_PX } from '../utils/canvasCoordinates'
import { snapToPointAlignment, polylineSkipsAlignment } from '../Components/Canvas'

/**
 * Zoom-aware snap magnet.
 *
 * Stored geometry is PDF/canvas pixels. CSS zoom scales the canvas on screen
 * (`width: canvasWidth * zoom`), and canvasPoint() converts the pointer back
 * into canvas pixels: canvasPx = screenPx / zoom.
 *
 * MESH_SNAP_THRESHOLD used to be 15 canvas pixels. At a typical site-plan
 * zoom-out that magnet collapses to 15*zoom screen pixels (e.g. 3.75px at
 * zoom 0.25) so wall/mesh/point snap feels missing. EFS bay hit already uses
 * `10 / zoom` for the same reason. Alignment must use 15 *screen* pixels.
 */
describe('canvasSnapThreshold', () => {
    it('keeps 15 canvas px at zoom 1 (pre-zoom behaviour)', () => {
        expect(canvasSnapThreshold(SNAP_SCREEN_PX, 1)).toBe(15)
    })

    it('widens the canvas-pixel magnet at zoom-out so 15 screen px stay 15 screen px', () => {
        expect(canvasSnapThreshold(SNAP_SCREEN_PX, 0.25)).toBe(60)
        expect(canvasSnapThreshold(SNAP_SCREEN_PX, 0.5)).toBe(30)
    })

    it('tightens the canvas-pixel magnet at zoom-in', () => {
        expect(canvasSnapThreshold(SNAP_SCREEN_PX, 2)).toBe(7.5)
    })

    it('matches the EFS bay-hit pattern of screenPx / zoom', () => {
        expect(canvasSnapThreshold(10, 0.5)).toBe(10 / 0.5)
    })

    it('falls back to the screen value when zoom is missing or non-positive', () => {
        expect(canvasSnapThreshold(15, 0)).toBe(15)
        expect(canvasSnapThreshold(15, -1)).toBe(15)
        expect(canvasSnapThreshold(15, undefined)).toBe(15)
        expect(canvasSnapThreshold(15, NaN)).toBe(15)
    })
})

describe('snap at zoom-out vs the old 15 canvas-px magnet', () => {
    const coords = { xCoords: [100], yCoords: [200] }

    it('does not snap 30 canvas px away when the threshold is still 15 canvas px (zoom 1)', () => {
        const result = snapToPointAlignment({ x: 130, y: 500 }, coords, canvasSnapThreshold(SNAP_SCREEN_PX, 1))
        expect(result.snapped.x).toBe(130)
        expect(result.guides).toEqual([])
    })

    it('does snap 30 canvas px away at zoom 0.25 (30 canvas px is 7.5 screen px, inside 15 screen px)', () => {
        const result = snapToPointAlignment({ x: 130, y: 500 }, coords, canvasSnapThreshold(SNAP_SCREEN_PX, 0.25))
        expect(result.snapped.x).toBe(100)
        expect(result.guides).toEqual([{ type: 'vertical', x: 100 }])
    })

    it('still ignores a far cursor at zoom-out (200 canvas px is 50 screen px at zoom 0.25)', () => {
        const result = snapToPointAlignment({ x: 300, y: 500 }, coords, canvasSnapThreshold(SNAP_SCREEN_PX, 0.25))
        expect(result.snapped.x).toBe(300)
        expect(result.guides).toEqual([])
    })
})

describe('polylineSkipsAlignment', () => {
    it('keeps FDS wall (obstruction) on the point-alignment waterfall', () => {
        expect(polylineSkipsAlignment('obstruction')).toBe(false)
    })

    it('does not skip doors, inlets, or extracts', () => {
        expect(polylineSkipsAlignment('door')).toBe(false)
        expect(polylineSkipsAlignment('inlet')).toBe(false)
        expect(polylineSkipsAlignment('extract')).toBe(false)
    })

    it('leaves EFS wall/boundary freehand (Kevin EFS UX)', () => {
        expect(polylineSkipsAlignment('efsWall')).toBe(true)
        expect(polylineSkipsAlignment('efsBoundary')).toBe(true)
    })
})
