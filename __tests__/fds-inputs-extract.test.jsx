// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useStore from '../store/useStore'
import FDSInputsPopup from '../Components/FDSInputsPopup'

function setupStoreWithExtract(extractId) {
    const store = useStore.getState()
    store.addElement({
        id: extractId,
        type: 'line',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        comments: 'extract',
    })
}

function renderAndSwitchToExtractsTab() {
    render(<FDSInputsPopup handleUserInput={() => {}} />)
    const extractsTab = screen.getByText('Extracts')
    fireEvent.click(extractsTab)
}

describe('FDSInputsPopup: extract shaft config', () => {
    beforeEach(() => {
        useStore.setState({
            elements: [],
            extractConfig: {},
            highlightedExtractId: null,
        })
    })

    it('"Extracts" tab button renders', () => {
        render(<FDSInputsPopup handleUserInput={() => {}} />)
        expect(screen.getByText('Extracts')).toBeInTheDocument()
    })

    it('type dropdown has "Natural" and "Mechanical" options', () => {
        setupStoreWithExtract('extract-1')
        renderAndSwitchToExtractsTab()

        expect(screen.getByText('Natural')).toBeInTheDocument()
        expect(screen.getByText('Mechanical')).toBeInTheDocument()
    })

    it('when type is "mechanical", flow rate input appears', () => {
        setupStoreWithExtract('extract-1')
        useStore.setState({
            extractConfig: {
                'extract-1': {
                    type: 'mechanical',
                    flowRate: 3.0,
                    shaftWidth: 0.9,
                    shaftDepth: 0.9,
                    activation: 'always_open',
                    activationTime: null,
                },
            },
        })
        renderAndSwitchToExtractsTab()

        expect(screen.getByText('Flow Rate (m\u00B3/s):')).toBeInTheDocument()
    })

    it('shaft width and depth inputs render', () => {
        setupStoreWithExtract('extract-1')
        renderAndSwitchToExtractsTab()

        expect(screen.getByText('Shaft Width (m):')).toBeInTheDocument()
        expect(screen.getByText('Shaft Depth (m):')).toBeInTheDocument()
    })

    it('activation dropdown has "Always Open", "Timed", "Sprinkler"', () => {
        setupStoreWithExtract('extract-1')
        renderAndSwitchToExtractsTab()

        const options = screen.getAllByRole('option')
        const optionTexts = options.map(o => o.textContent)
        expect(optionTexts).toContain('Always Open')
        expect(optionTexts).toContain('Timed')
        expect(optionTexts).toContain('Sprinkler')
    })

    it('when activation is "timed", activation time input appears', () => {
        setupStoreWithExtract('extract-1')
        useStore.setState({
            extractConfig: {
                'extract-1': {
                    type: 'natural',
                    flowRate: 3.0,
                    shaftWidth: 0.9,
                    shaftDepth: 0.9,
                    activation: 'timed',
                    activationTime: 60,
                },
            },
        })
        renderAndSwitchToExtractsTab()

        expect(screen.getByText('Activation Time (s):')).toBeInTheDocument()
    })
})
