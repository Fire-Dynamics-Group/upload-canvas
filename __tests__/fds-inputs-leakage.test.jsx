// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useStore from '../store/useStore'
import FDSInputsPopup from '../Components/FDSInputsPopup'

// Set up store with a door element and common corridor mode for the doors tab
function setupStoreWithDoor(doorId, role) {
    const store = useStore.getState()
    // Add a door element so the doors tab has something to render
    store.addElement({
        id: doorId,
        type: 'line',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        comments: 'door',
    })
    store.setCommonCorridorMode(true)
    if (role) {
        store.setDoorRoles({ [doorId]: role })
    }
}

function renderAndSwitchToDoorsTab() {
    render(<FDSInputsPopup handleUserInput={() => {}} />)
    const doorsTab = screen.getByText('Doors')
    fireEvent.click(doorsTab)
}

describe('FDSInputsPopup: leakage door role', () => {
    beforeEach(() => {
        // Reset store state manually instead of calling resetProject (which touches IndexedDB)
        useStore.setState({
            elements: [],
            doorRoles: {},
            doorLeakageConfig: {},
            doorLeakagesEnabled: true,
            commonCorridorMode: false,
        })
    })

    it('dropdown contains "Leakage Only (no hole)" option', () => {
        setupStoreWithDoor('door-1', null)
        renderAndSwitchToDoorsTab()

        const leakageOption = screen.getByText('Leakage Only (no hole)')
        expect(leakageOption).toBeInTheDocument()
        expect(leakageOption.tagName).toBe('OPTION')
        expect(leakageOption).toHaveAttribute('value', 'leakage')
    })

    it('when role is "leakage", the leakage enable checkbox is NOT shown', () => {
        setupStoreWithDoor('door-1', 'leakage')
        renderAndSwitchToDoorsTab()

        // The "Include leakage" checkbox should NOT be present for leakage-only doors
        expect(screen.queryByText('Include leakage')).not.toBeInTheDocument()

        // But the description text should be shown
        expect(screen.getByText(/Leakage-only: wall stays solid/)).toBeInTheDocument()
    })

    it('when role is "leakage", the seal type dropdown IS shown', () => {
        setupStoreWithDoor('door-1', 'leakage')
        renderAndSwitchToDoorsTab()

        // Seal type options should be present
        expect(screen.getByText('Smoke Sealed')).toBeInTheDocument()
        expect(screen.getByText('Non-Smoke Sealed')).toBeInTheDocument()
    })

    it('when role is NOT "leakage", the leakage enable checkbox IS shown', () => {
        setupStoreWithDoor('door-1', 'apartment')
        renderAndSwitchToDoorsTab()

        // The "Include leakage" checkbox should be present for non-leakage doors
        expect(screen.getByText('Include leakage')).toBeInTheDocument()
    })
})

describe('FDSInputsPopup: always_open door role', () => {
    beforeEach(() => {
        useStore.setState({
            elements: [],
            doorRoles: {},
            doorLeakageConfig: {},
            doorLeakagesEnabled: true,
            commonCorridorMode: false,
        })
    })

    it('dropdown contains "Always Open (permanent hole)" option between Lobby Door and Leakage Only', () => {
        setupStoreWithDoor('door-1', null)
        renderAndSwitchToDoorsTab()

        const alwaysOpenOption = screen.getByText('Always Open (permanent hole)')
        expect(alwaysOpenOption).toBeInTheDocument()
        expect(alwaysOpenOption.tagName).toBe('OPTION')
        expect(alwaysOpenOption).toHaveAttribute('value', 'always_open')
    })

    it('when role is "always_open", the leakage config section is hidden entirely', () => {
        setupStoreWithDoor('door-1', 'always_open')
        renderAndSwitchToDoorsTab()

        // No "Include leakage" checkbox
        expect(screen.queryByText('Include leakage')).not.toBeInTheDocument()
        // No leakage-only description
        expect(screen.queryByText(/Leakage-only: wall stays solid/)).not.toBeInTheDocument()
        // No seal type dropdown options
        expect(screen.queryByText('Smoke Sealed')).not.toBeInTheDocument()
        expect(screen.queryByText('Non-Smoke Sealed')).not.toBeInTheDocument()
    })
})
