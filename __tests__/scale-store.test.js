// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import useStore from '../store/useStore'
import { DEFAULT_RENDER_SCALE } from '../utils/scaleCalibration'

// Issue #15 store wiring — the calibration is the source of truth; pixelsPerMesh
// is derived from it × renderScale and recomputed whenever either changes.

const calibration = {
    pagePointsPerMesh: 4,
    points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
    lengthMeters: 5,
}

describe('store scale calibration', () => {
    beforeEach(() => {
        useStore.setState({
            scaleCalibration: null,
            pixelsPerMesh: 1,
            renderScale: DEFAULT_RENDER_SCALE,
            currentMode: 'fdsGen',
        })
    })

    it('defaults to no calibration and the 1.5 render scale', () => {
        expect(useStore.getState().scaleCalibration).toBeNull()
        expect(useStore.getState().renderScale).toBe(1.5)
    })

    it('setScaleCalibration stores it and derives pixelsPerMesh', () => {
        useStore.getState().setScaleCalibration(calibration)
        expect(useStore.getState().scaleCalibration).toEqual(calibration)
        expect(useStore.getState().pixelsPerMesh).toBeCloseTo(6, 10) // 4 × 1.5
    })

    it('setRenderScale re-derives pixelsPerMesh from the existing calibration', () => {
        useStore.getState().setScaleCalibration(calibration)
        useStore.getState().setRenderScale(3.0)
        expect(useStore.getState().renderScale).toBe(3.0)
        expect(useStore.getState().pixelsPerMesh).toBeCloseTo(12, 10) // 4 × 3.0
    })

    it('setRenderScale leaves an uncalibrated project at the unset sentinel', () => {
        useStore.getState().setRenderScale(3.0)
        expect(useStore.getState().pixelsPerMesh).toBe(1)
    })

    it('resetProject clears the calibration back to unset', () => {
        useStore.getState().setScaleCalibration(calibration)
        useStore.getState().resetProject()
        expect(useStore.getState().scaleCalibration).toBeNull()
        expect(useStore.getState().pixelsPerMesh).toBe(1)
    })
})
