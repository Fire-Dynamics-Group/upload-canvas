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
// returned unprotected-area table.
describe('EfsPopup — BRE 135 enclosing-rectangle tab', () => {
    beforeEach(() => {
        useStore.setState({
            convertedPoints: [
                { id: 1, comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 96, y: 0 }] },
            ],
        })
    })

    it('calls calculateEfs and shows the per-elevation results table', async () => {
        calculateEfs.mockResolvedValue({
            elevations: [
                {
                    elevation_number: 1,
                    boundary_distance: '6.0',
                    er_width: '96.0',
                    er_height: '18.0',
                    bre_width: '100',
                    bre_height: '18',
                    bre_percentage: '22.5%',
                    allowable_area: '405.0',
                    actual_area: '1728.0',
                    actual_protected_area: '1323.0',
                    actual_percentage: '77.0%',
                },
            ],
        })

        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Enclosing rectangle (BRE 135)'))
        // Width is seeded from the drawn wall (96 m).
        fireEvent.click(screen.getByText('Calc'))

        await waitFor(() => expect(calculateEfs).toHaveBeenCalled())
        const [elevationsArg] = calculateEfs.mock.calls[0]
        expect(elevationsArg[0].width).toBe(96)
        expect(await screen.findByText('22.5%')).toBeTruthy()
    })
})
