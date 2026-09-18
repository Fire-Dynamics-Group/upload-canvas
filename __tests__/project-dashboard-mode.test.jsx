// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectDashboard from '../Components/ProjectDashboard'
import { listProjects } from '../Components/ApiCalls'
import useStore from '../store/useStore'

// Each DB-backed mode has its own project list. The dashboard asks the API
// for the active mode's projects only, and re-fetches when the user switches
// to another DB-backed mode from the mode bar. Non-DB modes (radiation/efs)
// leave the dashboard for the upload screen instead.
vi.mock('../Components/ApiCalls', () => ({
    listProjects: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
}))

const fdsProject = { id: 'p1', name: 'Crown Wharf', mode: 'fdsGen', created_by: 'Ian', floors: [], settings: {} }
const teqProject = { id: 'p2', name: 'Panattoni Unit 3', mode: 'timeEq', created_by: 'Ian', floors: [], settings: {} }

const noop = () => {}

describe('ProjectDashboard - per-mode project lists', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useStore.setState({ currentMode: 'fdsGen', projectId: null, floorId: null, projectName: null })
        listProjects.mockImplementation(async (mode) => (mode === 'timeEq' ? [teqProject] : [fdsProject]))
    })

    it('lists only the active mode projects', async () => {
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" />)
        await screen.findByText('Crown Wharf')
        expect(listProjects).toHaveBeenCalledWith('fdsGen')
        expect(screen.queryByText('Panattoni Unit 3')).toBeNull()
    })

    it('switching to Time Equivalence stays on the dashboard and re-lists for timeEq', async () => {
        const onModeSwitch = vi.fn()
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" onModeSwitch={onModeSwitch} />)
        await screen.findByText('Crown Wharf')

        fireEvent.click(screen.getByText('Time Equivalence'))

        await screen.findByText('Panattoni Unit 3')
        expect(listProjects).toHaveBeenLastCalledWith('timeEq')
        expect(screen.queryByText('Crown Wharf')).toBeNull()
        expect(useStore.getState().currentMode).toBe('timeEq')
        // DB-backed target: no hand-off to the upload screen
        expect(onModeSwitch).not.toHaveBeenCalled()
    })

    it('switching to a non-DB mode hands off to the upload screen', async () => {
        const onModeSwitch = vi.fn()
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" onModeSwitch={onModeSwitch} />)
        await screen.findByText('Crown Wharf')

        fireEvent.click(screen.getByText('Radiation'))

        await waitFor(() => expect(onModeSwitch).toHaveBeenCalledWith('radiation'))
    })
})
