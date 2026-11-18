// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReportBuilderTab from '../Components/StructuralFire/ReportBuilderTab'

vi.mock('../Components/ApiCalls', () => ({
    saveProjectToServer: vi.fn(),
    downloadStructuralFireReport: vi.fn(),
    getFeeEngineers: vi.fn().mockResolvedValue([
        { full_name: 'Ian Shaw' },
        { full_name: 'Diana Prostire' },
        { full_name: 'Kevin Kurniawan' },
    ]),
    getFeeGenerationsForProject: vi.fn().mockResolvedValue([]),
    getPreviousFeeOptions: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/auth/token', () => ({
    authedFetch: vi.fn(),
}))

import {
    saveProjectToServer,
    downloadStructuralFireReport,
    getFeeEngineers,
    getFeeGenerationsForProject,
    getPreviousFeeOptions,
} from '../Components/ApiCalls'
import { authedFetch } from '../lib/auth/token'

describe('ReportBuilderTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('displays honest readiness summary and saves + downloads collated report', async () => {
        const project = {
            id: 'proj-42',
            name: 'Apex Hub',
            settings: {
                reportDetails: {
                    client: 'Acme Ltd',
                    location: 'Leeds',
                },
                macsBatch: {
                    name: 'Floor 1 Batch',
                    run_count: 1000,
                    pass_count: 990,
                    reliability_percent: 99.0,
                    charts: { scatter: 'a', totalCapacity: 'b', beamTemp: 'c', meshTemp: 'd' },
                },
                timeEqInputs: {
                    section: 'UB 406x140x39',
                    criticalTemp: 534,
                    fireResistancePeriod: 60,
                    isSprinklered: true,
                },
                timeEqResult: {
                    reliabilityPercent: 98.7,
                    nSim: 1000,
                    nFailed: 13,
                    charts: { steelTempSpaghetti: 'e', passFailScatter: 'f' },
                },
            },
        }

        const updatedProject = {
            ...project,
            settings: {
                ...project.settings,
                reportDetails: {
                    ...project.settings.reportDetails,
                    author: 'Ian Shaw',
                },
            },
        }
        saveProjectToServer.mockResolvedValue(updatedProject)
        downloadStructuralFireReport.mockResolvedValue()

        const onProjectUpdated = vi.fn()
        render(
            <ReportBuilderTab
                project={project}
                effectiveBatch={project.settings.macsBatch}
                userName="Ian Shaw"
                onProjectUpdated={onProjectUpdated}
            />
        )

        expect(screen.getByText(/Floor 1 Batch/i)).toBeTruthy()
        expect(screen.getByText(/99\.00%/)).toBeTruthy()
        expect(screen.getByText(/4 \/ 4 charts/i)).toBeTruthy()
        expect(screen.getByText(/98\.70%/)).toBeTruthy()
        expect(screen.getByText(/2 \/ 2 charts/i)).toBeTruthy()
        expect(screen.getByText(/Populated after QA process/i)).toBeTruthy()

        const authorSelect = screen.getByLabelText(/Author/i)
        expect(authorSelect.value).toBe('Ian Shaw')
        await waitFor(() => expect(getFeeEngineers).toHaveBeenCalled())
        fireEvent.change(authorSelect, { target: { value: 'Diana Prostire' } })
        fireEvent.click(screen.getByRole('button', { name: /Save & Download Report \(\.docx\)/i }))

        await waitFor(() => expect(saveProjectToServer).toHaveBeenCalledTimes(1))
        expect(saveProjectToServer.mock.calls[0][0]).toBe('proj-42')
        expect(saveProjectToServer.mock.calls[0][1].settings.reportDetails.author).toBe('Diana Prostire')
        expect(onProjectUpdated).toHaveBeenCalledWith(updatedProject)
        expect(downloadStructuralFireReport).toHaveBeenCalledWith('proj-42', 'Apex Hub', '')
    })

    it('shows honest empty states when MACS+ and Time Eq have not been run', () => {
        const project = {
            id: 'proj-empty',
            name: 'Empty Project',
            settings: {},
        }

        render(<ReportBuilderTab project={project} effectiveBatch={null} />)

        expect(screen.getByText(/No MACS\+ batch linked/i)).toBeTruthy()
        expect(screen.getByText(/No Time Equivalence results saved/i)).toBeTruthy()
    })

    it('searches Synergy directory and prefills job number, project name, client, and location', async () => {
        getPreviousFeeOptions.mockResolvedValueOnce({
            options: {
                company: [{ value: 'Panattoni UK', by: 'Ian Shaw', count: 2 }],
                projectLocation: [{ value: 'Castleford, UK', by: 'Diana Prostire', count: 1 }],
            },
        })
        getFeeGenerationsForProject.mockResolvedValueOnce([
            {
                project_name: 'Panattoni California Drive',
                inputs: {
                    project: {
                        project_name: 'Panattoni California Drive',
                        project_location: 'Castleford, West Yorkshire',
                    },
                    design_stages: {
                        tma_structural: { included: true },
                        stage_4: { included: true },
                    },
                },
            },
        ])

        authedFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    items: [
                        {
                            id: 'org:1:proj:657',
                            number: '0657',
                            name: 'Panattoni California Drive',
                            label: '0657 — Panattoni California Drive',
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    project: { id: 'org:1:proj:657', label: '0657 — Panattoni California Drive' },
                    fields: {
                        projectName: { value: 'Panattoni California Drive' },
                        clientCompany: { value: 'Winvic Construction Ltd' },
                    },
                    client: { displayName: 'Winvic Construction Ltd' },
                    siteAddress: {
                        lines: ['California Drive'],
                        town: 'Castleford',
                        state: 'West Yorkshire',
                        postcode: 'WF10 5QH',
                    },
                }),
            })

        render(
            <ReportBuilderTab
                project={{ id: 'proj-1', name: 'Draft', settings: {} }}
                effectiveBatch={null}
                userName="Ian Shaw"
            />
        )

        const searchInput = screen.getByLabelText(/Search Project Name \/ Job Number/i)
        fireEvent.change(searchInput, { target: { value: '0657' } })

        const resultBtn = await screen.findByRole('button', { name: /0657 — Panattoni California Drive/i })
        fireEvent.click(resultBtn)

        await waitFor(() => {
            expect(screen.getByLabelText(/^Job Number$/i).value).toBe('0657')
        })
        expect(screen.getByLabelText(/Project Name \(Report\)/i).value).toBe('Panattoni California Drive')
        expect(screen.getByLabelText(/Client Name/i).value).toBe('Winvic Construction Ltd')
        expect(screen.getByLabelText(/Site Location/i).value).toBe('California Drive, Castleford, West Yorkshire, WF10 5QH')
        expect(screen.getByText(/Tensile Membrane Action \(MACS\+\)/i)).toBeTruthy()
        expect(screen.queryByLabelText(/Building Description/i)).toBeNull()

        // Source badges & clickable option pills from past fee generations
        expect(screen.getAllByText('From Total Synergy').length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText(/Prev fee · Ian · 2×/i)).toBeTruthy()
        const altClientChip = await screen.findByRole('button', { name: /Panattoni UK/i })
        fireEvent.click(altClientChip)
        expect(screen.getByLabelText(/Client Name/i).value).toBe('Panattoni UK')
        expect(screen.getAllByText('From previous fee').length).toBeGreaterThanOrEqual(1)

        // Manual edit flips provenance badge to Edited by you
        fireEvent.change(screen.getByLabelText(/Client Name/i), { target: { value: 'Custom Client' } })
        expect(screen.getByText('Edited by you')).toBeTruthy()
    })

    it('surfaces an honest error when Synergy directory search fails', async () => {
        authedFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'unauthorized', code: 'missing_token' }),
        })

        render(
            <ReportBuilderTab
                project={{ id: 'proj-1', name: 'Draft', settings: {} }}
                effectiveBatch={null}
                userName="Ian Shaw"
            />
        )

        const searchInput = screen.getByLabelText(/Search Project Name \/ Job Number/i)
        fireEvent.change(searchInput, { target: { value: 'blackhorse' } })

        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toMatch(/Synergy search unavailable \(unauthorized\)/i)
    })
})
