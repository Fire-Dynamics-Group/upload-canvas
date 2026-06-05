// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import useStore from '../store/useStore'
import EfsPopup from '../Components/EfsPopup'
import { calculateEfs } from '../Components/ApiCalls'

// The BRE 135 tab posts to the backend; mock the API layer so the tab can be
// exercised without a server.
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
            efsCalcDone: false,
            efsHeight: 18,
            efsFireTempC: 1040,
        })
    })

    it('computes the governing required boundary distance from the drawn wall', () => {
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))
        // width 96, height 18, T 1313 K, spacing 8 -> centre gridline governs at 38.34 m
        expect(screen.getByText(/38\.3\d* m/)).toBeTruthy()
        expect(screen.getByText(/96\.00 m/)).toBeTruthy()
    })

    it('restores its inputs and result after being closed and reopened', () => {
        const { unmount } = render(<EfsPopup onClose={() => {}} />)
        // Change an input away from its default, then run the calc.
        fireEvent.change(screen.getByDisplayValue('1040'), { target: { value: '900' } })
        fireEvent.click(screen.getByText('Run Calc'))
        expect(screen.getByText(/Governing required boundary distance/)).toBeTruthy()

        // Close (unmount) and reopen (fresh mount) — the popup should come back
        // with the edited input and re-show the result without re-running.
        unmount()
        render(<EfsPopup onClose={() => {}} />)
        expect(screen.getByDisplayValue('900')).toBeTruthy()
        expect(screen.getByText(/Governing required boundary distance/)).toBeTruthy()
    })

    it('blanks the view factor / Is columns on a protected bay row', () => {
        // A protected bay no longer emits, so its own view factor / incident are
        // meaningless and shown as '—' (the required distance, driven by adjacent
        // unprotected bays, may still be non-zero).
        useStore.setState({
            convertedPoints: [
                { id: 1, comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 96, y: 0 }] },
                { id: 2, comments: 'efsBoundary', finalPoints: [{ x: 0, y: 30 }, { x: 96, y: 30 }] },
            ],
        })
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))

        // Before protecting: bay 1's view-factor cell is numeric.
        const cellsBefore = within(screen.getByLabelText('Protect bay 1').closest('tr')).getAllByRole('cell')
        expect(cellsBefore[2].textContent).not.toBe('—')

        // Protect bay 1, then its view factor (col 3) and Is (col 4) read '—'.
        fireEvent.click(screen.getByLabelText('Protect bay 1'))
        const cellsAfter = within(screen.getByLabelText('Protect bay 1').closest('tr')).getAllByRole('cell')
        expect(cellsAfter[2].textContent).toBe('—')
        expect(cellsAfter[3].textContent).toBe('—')
    })

    it('errors when no wall has been drawn', () => {
        useStore.setState({ convertedPoints: [] })
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))
        expect(screen.getByText(/No wall line found/)).toBeTruthy()
    })
})

// The BRE 135 (enclosing-rectangle) tab derives elevations from the drawn wall's
// faces, posts the per-elevation inputs to the backend and renders the returned
// unprotected-area table.
describe('EfsPopup — BRE 135 enclosing-rectangle tab', () => {
    beforeEach(() => {
        calculateEfs.mockReset()
        useStore.setState({
            convertedPoints: [
                // L-shaped wall: two faces -> two elevations (60 m, 40 m).
                { id: 1, comments: 'efsWall', finalPoints: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }] },
                // Boundary 10 m off the first face (parallel, in +y).
                { id: 2, comments: 'efsBoundary', finalPoints: [{ x: 0, y: 10 }, { x: 60, y: 10 }] },
            ],
            efsCalcDone: false,
            efsHeight: 18,
            efsFireTempC: 1040,
        })
    })

    it('derives elevations from the wall faces and calls calculateEfs', async () => {
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
        expect(elevationsArg).toHaveLength(2)
        expect(elevationsArg[0].width).toBeCloseTo(60)
        expect(elevationsArg[1].width).toBeCloseTo(40)
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
