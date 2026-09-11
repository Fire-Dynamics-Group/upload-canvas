// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TimeEquivalenceInputPopup from '../Components/TimeEquivalenceInputPopup'
import useStore from '../store/useStore'

// The popup seeds its inputs from the store slice (timeEqInputs) that the
// project hydrates, and writes every change back so the autosave sees it.
vi.mock('../Components/ApiCalls', () => ({
    sendTimeEqData: vi.fn(),
    sendTimeEqReliabilityData: vi.fn(),
    sendTimeEqReliabilityChartsData: vi.fn(),
}))

// A 4-wall compartment with two openings, in converted (metre) coordinates.
const POINTS = [
    {
        id: 0, comments: 'obstruction',
        finalPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 0 }],
    },
    { id: 1, comments: 'opening', finalPoints: [{ x: 10, y: 1 }, { x: 10, y: 2 }] },
    { id: 2, comments: 'opening', finalPoints: [{ x: 3, y: 5 }, { x: 5, y: 5 }] },
]

describe('TimeEquivalenceInputPopup - store-backed inputs', () => {
    beforeEach(() => {
        useStore.setState({ timeEqInputs: {}, timeEqResult: null, showTimeEqPopup: true })
    })

    it('seeds from saved inputs and writes the full inputs object back to the store', async () => {
        useStore.setState({
            timeEqInputs: {
                fireResistancePeriod: 60,
                isSprinklered: true,
                wallProperties: ['brick', 'brick', 'plasterboard', 'concrete'],
                openingHeights: [1.5, 2.2],
            },
        })
        render(<TimeEquivalenceInputPopup mockData={POINTS} />)

        expect(screen.getByDisplayValue('60')).toBeTruthy()

        await waitFor(() => {
            const saved = useStore.getState().timeEqInputs
            expect(saved.fireResistancePeriod).toBe(60)
            expect(saved.isSprinklered).toBe(true)
            expect(saved.wallProperties).toEqual(['brick', 'brick', 'plasterboard', 'concrete'])
            expect(saved.openingHeights).toEqual([1.5, 2.2])
            // geometry-derived defaults filled in for what was not saved
            expect(saved.openableWidths).toEqual([10, 5, 10, 5])
            expect(saved.compartmentHeight).toBe(3.15)
        })
    })

    it('pushes an edit into the store', async () => {
        render(<TimeEquivalenceInputPopup mockData={POINTS} />)
        const fr = screen.getByDisplayValue('90')
        fireEvent.change(fr, { target: { value: '45' } })
        await waitFor(() => expect(useStore.getState().timeEqInputs.fireResistancePeriod).toBe('45'))
    })

    it('drops saved per-wall values that no longer fit the drawing', async () => {
        useStore.setState({ timeEqInputs: { wallProperties: ['brick', 'brick'] } })
        render(<TimeEquivalenceInputPopup mockData={POINTS} />)
        await waitFor(() =>
            expect(useStore.getState().timeEqInputs.wallProperties).toEqual(['concrete', 'concrete', 'concrete', 'concrete'])
        )
    })
})
