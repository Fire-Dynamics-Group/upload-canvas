// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useStore from '../store/useStore'
import EfsPopup from '../Components/EfsPopup'

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
