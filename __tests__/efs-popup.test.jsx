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
            efsSprinklered: false,
        })
    })

    it('converts sprinklered temperature in both directions, including edited values', () => {
        render(<EfsPopup docked />)
        const toggle = screen.getByRole('switch', { name: 'Sprinklered' })
        expect(toggle.getAttribute('aria-checked')).toBe('false')
        fireEvent.click(toggle)
        const expected = (((1040 + 273) ** 4 / 2) ** 0.25) - 273
        expect(useStore.getState().efsFireTempC).toBeCloseTo(expected, 10)
        expect(toggle.getAttribute('aria-checked')).toBe('true')
        fireEvent.click(toggle)
        expect(useStore.getState().efsFireTempC).toBeCloseTo(1040, 10)
        fireEvent.click(toggle)
        fireEvent.change(screen.getByLabelText('Fire temperature (°C)'), { target: { value: '800' } })
        fireEvent.click(toggle)
        expect(useStore.getState().efsFireTempC).toBeCloseTo(((800 + 273) ** 4 * 2) ** 0.25 - 273, 10)
    })

    it('does not convert an empty temperature', () => {
        render(<EfsPopup docked />)
        fireEvent.change(screen.getByLabelText('Fire temperature (°C)'), { target: { value: '' } })
        const toggle = screen.getByRole('switch', { name: 'Sprinklered' })
        expect(toggle.disabled).toBe(true)
        fireEvent.click(toggle)
        expect(useStore.getState().efsSprinklered).toBe(false)
        expect(useStore.getState().efsFireTempC).toBe('')
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

    it('shows column distances and keeps segment protection separate', () => {
        useStore.setState({ efsColumnSpacing: 8, efsProtectedByElev: {}, efsEndSpacingByElev: {} })
        render(<EfsPopup onClose={() => {}} />)
        fireEvent.click(screen.getByText('Run Calc'))
        const table = screen.getByRole('table')
        expect(within(table).getByText('Column')).toBeTruthy()
        expect(within(table).getAllByRole('row')).toHaveLength(14)
        const before = within(table).getAllByRole('row')[1]
        const required = Number(within(before).getAllByRole('cell')[5].textContent)
        fireEvent.click(screen.getByLabelText('Protect bay 1'))
        const after = within(table).getAllByRole('row')[1]
        expect(Number(within(after).getAllByRole('cell')[5].textContent)).toBeLessThan(required)
        expect(within(table).queryByRole('checkbox')).toBeNull()
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
