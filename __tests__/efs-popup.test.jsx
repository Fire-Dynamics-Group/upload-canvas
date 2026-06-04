// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import useStore from '../store/useStore'
import EfsPopup from '../Components/EfsPopup'
import { calculateEfs } from '../Components/ApiCalls'

vi.mock('../Components/ApiCalls', () => ({
    calculateEfs: vi.fn(),
    downloadEfsReport: vi.fn(),
}))

// The popup reads the converted (metre-space) wall line from the store, runs the
// view-factor sweep, and shows the governing required boundary distance.
describe('EfsPopup — whole-elevation required boundary distance', () => {
    beforeEach(() => {
        useStore.setState({
            convertedPoints: [
                { id: 1, comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 96, y: 0 }] },
            ],
        })
    })

    it('computes the governing required boundary distance from the drawn wall', () => {
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))
        // width 96, height 18, T 1313 K, spacing 8 -> centre gridline governs at 38.34 m
        expect(screen.getByText(/38\.3\d* m/)).toBeTruthy()
        expect(screen.getByText(/96\.00 m/)).toBeTruthy()
    })

    it('errors when no wall has been drawn', () => {
        useStore.setState({ convertedPoints: [] })
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))
        expect(screen.getByText(/No wall line found/)).toBeTruthy()
    })
})

// The BRE 135 tab posts the per-elevation inputs to the backend and renders the
// returned unprotected-area table. Elevations are derived from the drawn wall's
// corners; boundary distance is the closest approach to the drawn boundary.
describe('EfsPopup — BRE 135 enclosing-rectangle tab', () => {
    beforeEach(() => {
        useStore.setState({
            convertedPoints: [
                // L-shaped wall: two straight segments -> two elevations (60 m, 40 m).
                { id: 1, comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }] },
                // Boundary 10 m off the first segment (parallel, in +y).
                { id: 2, comments: 'efsBoundary', finalPoints: [{ x: 0, y: 10 }, { x: 60, y: 10 }] },
            ],
        })
    })

    it('derives elevations from the wall corners and calls calculateEfs', async () => {
        calculateEfs.mockResolvedValue({
            elevations: [
                {
                    elevation_number: 1,
                    boundary_distance: '10.0',
                    er_width: '60.0',
                    er_height: '18.0',
                    bre_width: '60',
                    bre_height: '18',
                    bre_percentage: '22.5%',
                    allowable_area: '243.0',
                    actual_area: '1080.0',
                    actual_protected_area: '837.0',
                    actual_percentage: '77.5%',
                },
            ],
        })

        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Enclosing rectangle (BRE 135)'))
        fireEvent.click(screen.getByText('Calc'))

        await waitFor(() => expect(calculateEfs).toHaveBeenCalled())
        const [elevationsArg, isCommercialArg] = calculateEfs.mock.calls[0]
        // Two segments -> two elevations, widths 60 and 40.
        expect(elevationsArg).toHaveLength(2)
        expect(elevationsArg[0].width).toBeCloseTo(60)
        expect(elevationsArg[1].width).toBeCloseTo(40)
        // First elevation's boundary distance auto-derived from the drawn boundary.
        expect(elevationsArg[0].boundary_distance).toBeCloseTo(10)
        expect(isCommercialArg).toBe(true)
        expect(await screen.findByText('22.5%')).toBeTruthy()
    })

    it('shows guidance when no wall has been drawn', () => {
        useStore.setState({ convertedPoints: [] })
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Enclosing rectangle (BRE 135)'))
        expect(screen.getByText(/Draw a wall polyline first/)).toBeTruthy()
    })
})
