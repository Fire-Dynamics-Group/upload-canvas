// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useStore from '../store/useStore'
import EfsWorkspaceTools from '../Components/EfsWorkspaceTools'

describe('EFS report display controls', () => {
    beforeEach(() => {
        useStore.setState({
            efsShowScaleGrid: true,
            efsShowDistanceArrows: true,
            efsShowDistances: true,
            efsShowGridSquares: true,
            efsShowGridNumbers: true,
            efsShowBayLabels: true,
            efsWallLineWidth: 6,
            efsBoundaryLineWidth: 4,
            efsNeededBoundaryLineWidth: 4,
            efsArrowLineWidth: 1.5,
        })
    })

    it('toggles visibility checkboxes for scale grid, distance arrows, distances, bay markers, and bay numbers', () => {
        render(<EfsWorkspaceTools onChangeMode={() => {}} />)

        const scaleGridBox = screen.getByLabelText('Scale grid', { selector: 'input[type="checkbox"]' })
        const arrowsBox = screen.getByLabelText('Distance arrows', { selector: 'input[type="checkbox"]' })
        const distancesBox = screen.getByLabelText('Distances', { selector: 'input[type="checkbox"]' })
        const bayMarkersBox = screen.getByLabelText('Bay markers', { selector: 'input[type="checkbox"]' })
        const bayNumbersBox = screen.getByLabelText('Bay numbers', { selector: 'input[type="checkbox"]' })
        const bayLabelsBox = screen.getByLabelText('Bay labels (U/P)', { selector: 'input[type="checkbox"]' })

        expect(scaleGridBox.checked).toBe(true)
        expect(arrowsBox.checked).toBe(true)
        expect(distancesBox.checked).toBe(true)
        expect(bayMarkersBox.checked).toBe(true)
        expect(bayNumbersBox.checked).toBe(true)
        expect(bayLabelsBox.checked).toBe(true)

        fireEvent.click(scaleGridBox)
        fireEvent.click(arrowsBox)
        fireEvent.click(distancesBox)
        fireEvent.click(bayMarkersBox)
        fireEvent.click(bayNumbersBox)
        fireEvent.click(bayLabelsBox)

        const state = useStore.getState()
        expect(state.efsShowScaleGrid).toBe(false)
        expect(state.efsShowDistanceArrows).toBe(false)
        expect(state.efsShowDistances).toBe(false)
        expect(state.efsShowGridSquares).toBe(false)
        expect(state.efsShowGridNumbers).toBe(false)
        expect(state.efsShowBayLabels).toBe(false)
    })

    it('updates line thickness independently for each EFS element type', () => {
        render(<EfsWorkspaceTools onChangeMode={() => {}} />)

        fireEvent.change(screen.getByLabelText('Wall / bays line thickness'), { target: { value: '9' } })
        fireEvent.change(screen.getByLabelText('Boundary line thickness'), { target: { value: '2.5' } })
        fireEvent.change(screen.getByLabelText('Needed boundary line thickness'), { target: { value: '7' } })
        fireEvent.change(screen.getByLabelText('Distance arrows line thickness'), { target: { value: '3.5' } })

        const state = useStore.getState()
        expect(state.efsWallLineWidth).toBe(9)
        expect(state.efsBoundaryLineWidth).toBe(2.5)
        expect(state.efsNeededBoundaryLineWidth).toBe(7)
        expect(state.efsArrowLineWidth).toBe(3.5)
    })

    it('minimizes the calculation panel and reopens it from the left-menu footer button', () => {
        render(<EfsWorkspaceTools onChangeMode={() => {}} />)

        expect(screen.getByLabelText('Calculation parameters and results')).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Open calcs' })).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Minimize calculation panel' }))
        expect(screen.queryByLabelText('Calculation parameters and results')).toBeNull()

        const reopenBtn = screen.getByRole('button', { name: 'Open calcs' })
        fireEvent.click(reopenBtn)
        expect(screen.getByLabelText('Calculation parameters and results')).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Open calcs' })).toBeNull()
    })

    it('collapses the drawing tools panel to an icon-only expand button and re-expands it', () => {
        render(<EfsWorkspaceTools onChangeMode={() => {}} />)

        fireEvent.click(screen.getByRole('button', { name: 'Collapse drawing tools' }))
        const expandBtn = screen.getByRole('button', { name: 'Expand drawing tools' })
        expect(expandBtn.textContent).toBe('')
        expect(expandBtn.querySelector('svg')).toBeTruthy()

        fireEvent.click(expandBtn)
        expect(screen.getByRole('button', { name: 'Collapse drawing tools' })).toBeTruthy()
    })
})
