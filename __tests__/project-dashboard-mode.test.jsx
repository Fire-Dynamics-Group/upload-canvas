// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectDashboard from '../Components/ProjectDashboard'
import { listProjects, getMacsRuns } from '../Components/ApiCalls'
import useStore from '../store/useStore'

// Each DB-backed mode has its own project list. The dashboard asks the API
// for the active mode's projects only, and re-fetches when the user switches
// to another DB-backed mode from the mode bar. Non-DB modes (radiation/efs)
// leave the dashboard for the upload screen instead.
vi.mock('../Components/ApiCalls', () => ({
    listProjects: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
    getMacsRuns: vi.fn(async () => []),
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

    it('switching to MACS+ & Time Equivalence stays on the dashboard and re-lists for timeEq', async () => {
        const onModeSwitch = vi.fn()
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" onModeSwitch={onModeSwitch} />)
        await screen.findByText('Crown Wharf')

        fireEvent.click(screen.getByText('MACS+ & Time Equivalence'))

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

    it('renders structural project cards with MACS status and supports plan canvas access', async () => {
        const richTeqProject = {
            id: 'p-rich',
            name: 'Amazon Fulfillment Bay 2',
            mode: 'timeEq',
            created_by: 'Ian',
            updated_at: '2026-11-04T12:00:00Z',
            floors: [{ id: 'f1', elements: [{ id: 1 }] }],
            settings: {
                macsBatch: {
                    total_runs: 10000,
                    pass_count: 9920,
                    fail_count: 80,
                    reliability_percent: 99.2,
                    governing_section: 'UB 457x191x82',
                    critical_temp: 631,
                    shear_check: { sub_limit_runs: [] },
                },
                timeEqInputs: {
                    fireResistancePeriod: 90,
                    use: 'Storage',
                },
            },
        }
        listProjects.mockResolvedValue([richTeqProject])
        useStore.setState({ currentMode: 'timeEq' })

        const onSelect = vi.fn()
        render(<ProjectDashboard onSelectProject={onSelect} onNewProject={noop} userName="Ian" />)

        await screen.findByText('Amazon Fulfillment Bay 2')
        // MACS status badge
        expect(screen.getByText(/MACS: 10,000 Runs/i)).toBeInTheDocument()
        // Governing section
        expect(screen.getAllByText('UB 457x191x82').length).toBeGreaterThan(0)
        // Critical temp
        expect(screen.getByText('631°C')).toBeInTheDocument()
        // Target period
        expect(screen.getByText('REI 90m')).toBeInTheDocument()

        // Clicking secondary Plan button opens 2D canvas
        fireEvent.click(screen.getByTitle('Open compartment drawing on canvas'))
        expect(onSelect).toHaveBeenCalledWith('p-rich')
    })

    it('shows Awaiting MACS Data for calculator defaults and MACS Run Linked only after a macs-runs row loads', async () => {
        const defaults = {
            id: 'p-defaults',
            name: 'California Drive',
            mode: 'timeEq',
            created_by: 'Ian',
            created_at: '2026-11-09T12:00:00Z',
            floors: [],
            settings: { timeEqInputs: { criticalTemp: 500, sectionFactor: 135 } },
        }
        const fetched = {
            id: 'p-row',
            name: 'Fetched Run',
            mode: 'timeEq',
            created_by: 'Ian',
            created_at: '2026-11-08T12:00:00Z',
            floors: [],
            settings: { timeEqInputs: {} },
        }
        listProjects.mockResolvedValue([defaults, fetched])
        getMacsRuns.mockImplementation(async (id) => (
            id === 'p-row' ? [{ id: 'row-1', run_id: 'row-1' }] : []
        ))
        useStore.setState({ currentMode: 'timeEq' })

        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" />)

        await screen.findByText('California Drive')
        expect(screen.getByText('Fetched Run')).toBeInTheDocument()
        expect(screen.getAllByText('Awaiting MACS Data')).toHaveLength(1)
        expect(screen.getAllByText('MACS Run Linked')).toHaveLength(1)
        expect(screen.queryByText('MACS Batch Linked')).not.toBeInTheDocument()
    })
})
