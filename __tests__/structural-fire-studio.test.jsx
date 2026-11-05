import StructuralFirePage from '../pages/structural-fire'
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MacsCharts from '../Components/StructuralFire/MacsCharts'
import MacsRunDetail from '../Components/StructuralFire/MacsRunDetail'
import MacsRunsFeed from '../Components/StructuralFire/MacsRunsFeed'
import MacsSetupPanel from '../Components/StructuralFire/MacsSetupPanel'
import MacsBatchOverview from '../Components/StructuralFire/MacsBatchOverview'
import TimeEqWorkspace from '../Components/StructuralFire/TimeEqWorkspace'
import CompartmentMiniMap from '../Components/StructuralFire/CompartmentMiniMap'
import StructuralProjectCard, { getStructuralCardMetrics } from '../Components/StructuralProjectCard'
import { getAllMacsRuns, getMacsRunDetail } from '../Components/ApiCalls'

vi.mock('next/router', () => ({
    useRouter: () => ({
        query: {},
        push: vi.fn(),
    }),
}))
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

const SAMPLE_RUN = {
    id: 'run-uuid-1',
    label: 'Office Bay 1',
    section: 'UB 457x191x82',
    exposure: '3-sided',
    critical_temp: 631,
    governing_side: 'B',
    section_factor: 140,
    windows_user: 'ian.shaw',
    machine_name: 'WORKSTATION-1',
    client_timestamp: '2026-10-30T16:00:00Z',
    outputs: {
        uf_max: 0.84,
        max_deflection: 88,
        factored_hot: 6.5,
        comp_failure: 0,
        side_a_critical_temp: 685,
        side_a_load_ratio: 0.32,
        side_b_critical_temp: 631,
        side_b_load_ratio: 0.45,
        side_c_critical_temp: 710,
        side_c_load_ratio: 0.28,
        side_d_critical_temp: 690,
        side_d_load_ratio: 0.31,
    },
    checks: [
        { name: 'UF max <= 1.0', pass: true },
        { name: 'Composite failure', pass: true },
    ],
    time_series: [
        { time_step: 0, time_min: 0, fire_temp: 20, lofl_temp: 20, mesh_temp: 20, slabtop_temp: 20, slabbot_temp: 20, slab_cap: 350, beam_hot_capacity: 500, total_plate_capacity: 850, deflection: 0, utilization_factor: 0.1 },
        { time_step: 10, time_min: 30, fire_temp: 840, lofl_temp: 610, mesh_temp: 540, slabtop_temp: 65, slabbot_temp: 480, slab_cap: 290, beam_hot_capacity: 220, total_plate_capacity: 510, deflection: 45, utilization_factor: 0.65 },
        { time_step: 20, time_min: 60, fire_temp: 945, lofl_temp: 631, mesh_temp: 580, slabtop_temp: 95, slabbot_temp: 620, slab_cap: 260, beam_hot_capacity: 180, total_plate_capacity: 440, deflection: 88, utilization_factor: 0.84 },
    ],
}

describe('Structural Fire Engineering: Studio Components & APIs', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('API Calls: getAllMacsRuns and getMacsRunDetail', () => {
        it('getAllMacsRuns queries /projects/macs-runs with pagination', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [SAMPLE_RUN],
            })
            const runs = await getAllMacsRuns(20, 0)
            expect(runs).toEqual([SAMPLE_RUN])
            const [url, opts] = globalThis.fetch.mock.calls[0]
            expect(url).toContain('/projects/macs-runs?limit=20&offset=0')
            expect(opts.method).toBe('GET')
        })

        it('getMacsRunDetail queries /projects/macs-runs/:id', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => SAMPLE_RUN,
            })
            const run = await getMacsRunDetail('run-uuid-1')
            expect(run.critical_temp).toBe(631)
            const [url, opts] = globalThis.fetch.mock.calls[0]
            expect(url).toContain('/projects/macs-runs/run-uuid-1')
            expect(opts.method).toBe('GET')
        })
    })

    describe('MacsCharts', () => {
        it('renders temperature and capacity tabs and switches between them', () => {
            render(
                <MacsCharts
                    timeSeries={SAMPLE_RUN.time_series}
                    factoredHot={6.5}
                    timeLimit={60}
                />
            )
            // Tabs present
            expect(screen.getByText('Temperature Curves')).toBeInTheDocument()
            expect(screen.getByText('Capacity & Deflection')).toBeInTheDocument()

            // Temperature curve legend labels
            expect(screen.getByText('Unprotected beam')).toBeInTheDocument()

            // Switch tab
            fireEvent.click(screen.getByText('Capacity & Deflection'))
            expect(screen.getByText('Total capacity')).toBeInTheDocument()
            expect(screen.getByText('Deflection (right axis)')).toBeInTheDocument()
        })
    })

    describe('MacsRunDetail', () => {
        it('renders governing critical temperature and perimeter beams table', () => {
            const onApply = vi.fn()
            render(<MacsRunDetail run={SAMPLE_RUN} onApplyToTimeEq={onApply} />)

            expect(screen.getAllByText(/631\s*°C/).length).toBeGreaterThan(0)
            expect(screen.getByText(/Side B governs/i)).toBeInTheDocument()
            expect(screen.getByText('Side A')).toBeInTheDocument()
            expect(screen.getByText('Side B')).toBeInTheDocument()

            // Click Apply to Time Eq
            const applyBtn = screen.getByRole('button', { name: /Apply to Time Eq/i })
            fireEvent.click(applyBtn)
            expect(onApply).toHaveBeenCalledWith(SAMPLE_RUN)
        })
    })

    describe('MacsRunsFeed', () => {
        it('lists runs and filters by search term', () => {
            const onSelect = vi.fn()
            const otherRun = {
                id: 'run-uuid-2',
                label: 'Roof Truss',
                section: 'UB 305x127x42',
                critical_temp: 580,
                governing_side: 'A',
            }
            render(
                <MacsRunsFeed
                    runs={[SAMPLE_RUN, otherRun]}
                    selectedRunId="run-uuid-1"
                    onSelectRun={onSelect}
                />
            )
            expect(screen.getByText('UB 457x191x82')).toBeInTheDocument()
            expect(screen.getByText('UB 305x127x42')).toBeInTheDocument()

            // Filter
            const searchInput = screen.getByPlaceholderText(/Search section/i)
            fireEvent.change(searchInput, { target: { value: '457' } })
            expect(screen.getByText('UB 457x191x82')).toBeInTheDocument()
            expect(screen.queryByText('UB 305x127x42')).not.toBeInTheDocument()
        })

        it('renders batch metrics dynamically with 25 runs and not hardcoded 10,000', () => {
            const batch25 = {
                batch_id: '17664d75cd434fa0b1f44743d65a4134',
                name: 'CSV import test (25 of 10k)',
                run_count: 25,
                pass_count: 4,
                fail_count: 21,
                reliability_percent: 16.0,
            }
            render(<MacsRunsFeed runs={[SAMPLE_RUN]} batch={batch25} />)

            expect(screen.getByText('CSV import test (25 of 10k)')).toBeInTheDocument()
            expect(screen.getByText('16% Rel.')).toBeInTheDocument()
            expect(screen.getByText(/25 runs · 4 pass · 21 fail/i)).toBeInTheDocument()
            expect(screen.queryByText(/10,000 runs · 9,999 pass · 1 fail/i)).not.toBeInTheDocument()
        })
    })

    describe('TimeEqWorkspace', () => {
        it('renders project metrics, allows syncing from MACS, and provides Edit on Canvas link', () => {
            const project = {
                id: 'p-100',
                name: 'Site Plan Compartment',
                mode: 'timeEq',
                settings: {
                    timeEqInputs: {
                        criticalTemp: 550,
                        section: 'UB 356x171x57',
                        fireResistancePeriod: 60,
                    },
                    timeEqResult: {
                        failure_prob: 0.024,
                        beta: 1.98,
                        fractile_equiv_time: 44.2,
                    },
                },
            }

            render(
                <TimeEqWorkspace
                    project={project}
                    floorDetail={{ elements: [{ comments: 'obstruction' }] }}
                    selectedMacsRun={SAMPLE_RUN}
                />
            )

            // Results displayed
            expect(screen.getByText('2.40 %')).toBeInTheDocument()
            expect(screen.getByText(/1\.98/)).toBeInTheDocument()
            expect(screen.getByText('44.2 min')).toBeInTheDocument()

            // Edit on Canvas button exists
            expect(screen.getByRole('button', { name: /Edit Geometry on Canvas/i })).toBeInTheDocument()

            // Sync from selected MACS run button
            const syncBtn = screen.getByRole('button', { name: /Sync Critical Temp/i })
            fireEvent.click(syncBtn)

            // Critical temp input should update to 631
            const tempInput = screen.getByDisplayValue('631')
            expect(tempInput).toBeInTheDocument()
        })

        it('renders saved charts and download button when present in timeEqResult', () => {
            const projectWithCharts = {
                id: 'p-101',
                name: 'Office Tower Bay',
                mode: 'timeEq',
                settings: {
                    timeEqInputs: {
                        criticalTemp: 631,
                        memberProtection: 'unprotected',
                    },
                    timeEqResult: {
                        reliabilityPercent: 99.8,
                        nSim: 10000,
                        seed: 42,
                        criticalTemp: 631,
                        charts: {
                            steelTempSpaghetti: 'fake-base64-spaghetti',
                            passFailScatter: 'fake-base64-scatter',
                        },
                    },
                },
            }

            render(
                <TimeEqWorkspace
                    project={projectWithCharts}
                    floorDetail={{ elements: [{ comments: 'obstruction' }] }}
                />
            )

            // Monte Carlo charts section header
            expect(screen.getByText('Monte Carlo Reliability Charts')).toBeInTheDocument()
            expect(screen.getByText('N = 10000 fires')).toBeInTheDocument()
            expect(screen.getByText('Seed: 42')).toBeInTheDocument()

            // Both charts rendered
            expect(screen.getByAltText('Steel Temperature Spaghetti')).toBeInTheDocument()
            expect(screen.getByAltText('Pass Fail Scatter')).toBeInTheDocument()

            // Download charts button
            expect(screen.getByRole('button', { name: /Download Charts/i })).toBeInTheDocument()
        })

        it('renders MacsSetupPanel with geometry, deck, slab and beam configuration', () => {
            const sampleSetup = {
                run_count: 10000,
                groups: [
                    {
                        title: 'Geometry',
                        fields: [
                            { key: 'span1', label: 'Span 1', value: 7.3, unit: 'm', varies: false },
                            { key: 'span2', label: 'Span 2', value: 7.48, unit: 'm', varies: false },
                            { key: 'numbeam', label: 'Number of beams', value: 2, unit: '', varies: false },
                        ],
                    },
                    {
                        title: 'Deck',
                        fields: [
                            { key: 'deck_name', label: 'Deck profile', value: 'Multideck 60', unit: '', varies: false },
                            { key: 'deck_depth', label: 'Deck depth', value: 60, unit: 'mm', varies: false },
                        ],
                    },
                    {
                        title: 'Slab',
                        fields: [
                            { key: 'conc_type', label: 'Concrete type', value: 'NW', unit: '', varies: false },
                            { key: 'fck', label: 'fck', value: 30, unit: 'MPa', varies: false },
                            { key: 'slab_depth', label: 'Slab depth', value: 150, unit: 'mm', varies: false },
                        ],
                    },
                    {
                        title: 'Beams',
                        fields: [
                            { key: 'u_sec_size', label: 'Unprotected section', value: 'UB_356x127x33', unit: '', varies: false },
                            { key: 'side_a_sec', label: 'Side A section', value: 'UB_356x127x33', unit: '', varies: false },
                            { key: 'side_b_sec', label: 'Side B section', value: 'UB_457x152x52', unit: '', varies: false },
                        ],
                    },
                ],
            }

            render(<MacsSetupPanel setup={sampleSetup} defaultOpen={true} />)

            expect(screen.getByText(/SETUP/i)).toBeInTheDocument()
            expect(screen.getByText(/shared across 10,000 runs/i)).toBeInTheDocument()
            expect(screen.getByText('Span 1')).toBeInTheDocument()
            expect(screen.getByText('7.3 m')).toBeInTheDocument()
            expect(screen.getByText('Multideck 60')).toBeInTheDocument()
            expect(screen.getByText('30 MPa')).toBeInTheDocument()
            expect(screen.getByText('150 mm')).toBeInTheDocument()
            expect(screen.getByText('Side B section')).toBeInTheDocument()
            expect(screen.getByText('UB_457x152x52')).toBeInTheDocument()
        })

        it('renders MacsBatchOverview with reliability badge, setup panel, and representative runs', () => {
            const sampleBatch = {
                batch_id: 'd78c51f88cc9432da40b6e42dd3104b3',
                name: 'd78c51f8',
                run_count: 10000,
                pass_count: 9999,
                fail_count: 1,
                reliability_percent: 99.99,
                setup: {
                    run_count: 10000,
                    groups: [
                        {
                            title: 'Geometry',
                            fields: [{ key: 'span1', label: 'Span 1', value: 7.3, unit: 'm', varies: false }],
                        },
                    ],
                },
                shear_check: { checked: true, sub_limit_runs: [] },
                distributions: {},
                scatter: [],
            }

            const mockApply = vi.fn()
            render(
                <MacsBatchOverview
                    batch={sampleBatch}
                    runs={[SAMPLE_RUN]}
                    selectedRun={SAMPLE_RUN}
                    onApplyToTimeEq={mockApply}
                />
            )

            expect(screen.getByText('d78c51f8')).toBeInTheDocument()
            expect(screen.getByText('99.99% Reliability')).toBeInTheDocument()
            expect(screen.getAllByText(/10,000 runs/i).length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText(/9,999 pass/i)).toBeInTheDocument()
            expect(screen.getByText(/1 fail/i)).toBeInTheDocument()

            // Apply button
            const applyBtn = screen.getByRole('button', { name: /Apply Governing Beam/i })
            expect(applyBtn).toBeInTheDocument()
            fireEvent.click(applyBtn)
            expect(mockApply).toHaveBeenCalledWith(SAMPLE_RUN)
        })

        it('renders MacsBatchOverview with 4 Matplotlib PNG charts and lightbox modal', () => {
            const batchWithCharts = {
                batch_id: 'd78c51f88cc9432da40b6e42dd3104b3',
                name: 'Batch-42',
                run_count: 10000,
                pass_count: 9999,
                fail_count: 1,
                reliability_percent: 99.99,
                charts: {
                    scatter: 'b64-scatter',
                    totalCapacity: 'b64-capacity',
                    beamTemp: 'b64-beam',
                    meshTemp: 'b64-mesh',
                },
                shear_check: { checked: true, sub_limit_runs: [] },
            }

            render(<MacsBatchOverview batch={batchWithCharts} />)

            expect(screen.getByText('MACS+ Monte Carlo Batch Charts')).toBeInTheDocument()
            expect(screen.getByAltText('Failure Mechanism and Capacity Scatter')).toBeInTheDocument()
            expect(screen.getByAltText('Total Slab Capacity Distribution')).toBeInTheDocument()
            expect(screen.getByAltText('Unprotected Beam Temperature Distribution')).toBeInTheDocument()
            expect(screen.getByAltText('Reinforcement Bar Temperature Distribution')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Download Charts \(PNG\)/i })).toBeInTheDocument()

            // Click chart to open lightbox modal
            const scatterImg = screen.getByAltText('Failure Mechanism and Capacity Scatter')
            fireEvent.click(scatterImg)
            expect(screen.getAllByText('Failure Mechanism & Capacity Scatter').length).toBeGreaterThanOrEqual(1)
            // Close modal
            const closeBtn = screen.getByRole('button', { name: '✕' })
            fireEvent.click(closeBtn)
            expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument()
        })

        it('triggers downloadStructuralFireReport on Download report button click', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                blob: async () => new Blob(['docx-bytes'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
            })

            const batch = {
                batch_id: 'batch-abc-123',
                name: 'Office_Project_Run',
                run_count: 10000,
                pass_count: 10000,
                fail_count: 0,
            }

            render(<MacsBatchOverview projectId="proj-999" batch={batch} />)

            const downloadBtn = screen.getByRole('button', { name: /Download report/i })
            fireEvent.click(downloadBtn)

            await waitFor(() => {
                const call = globalThis.fetch.mock.calls.find(([u]) => u.includes('/projects/proj-999/structural-fire-report'))
                expect(call).toBeTruthy()
                expect(call[1].method).toBe('POST')
            })
        })

        it('TimeEqWorkspace renders Download Charts (PNG) button and hides Report (.docx) until enabled', async () => {
            const projectWithCharts = {
                id: 'p-200',
                name: 'Office Tower Bay',
                mode: 'timeEq',
                settings: {
                    timeEqInputs: {
                        criticalTemp: 631,
                    },
                    timeEqResult: {
                        reliabilityPercent: 99.8,
                        nSim: 10000,
                        seed: 42,
                        charts: {
                            steelTempSpaghetti: 'fake-spaghetti',
                            passFailScatter: 'fake-scatter',
                        },
                    },
                },
            }

            render(
                <TimeEqWorkspace
                    project={projectWithCharts}
                    floorDetail={{ elements: [{ comments: 'obstruction' }] }}
                />
            )

            const chartsBtn = screen.getByRole('button', { name: /Download Charts \(PNG\)/i })
            expect(chartsBtn).toBeInTheDocument()

            // Report button is hidden until report formatting is ready
            expect(screen.queryByRole('button', { name: /Download Report \(\.docx\)/i })).not.toBeInTheDocument()
        })

        it('renders honest empty state when floorDetail has no drawn elements', () => {
            const projectWithoutFloors = {
                id: 'p-empty',
                name: 'Empty Project',
                mode: 'timeEq',
                settings: {},
                floors: [],
            }
            render(
                <TimeEqWorkspace
                    project={projectWithoutFloors}
                    floorDetail={{ elements: [] }}
                />
            )

            expect(screen.getAllByText('No compartment drawn yet').length).toBe(2)
            expect(screen.getByText(/To run a Time Equivalence & Reliability assessment, open the 2D CAD canvas/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Open 2D Canvas/i })).toBeInTheDocument()

            const recalcBtn = screen.getByRole('button', { name: /Recalculate Time Eq/i })
            expect(recalcBtn).toBeDisabled()

            expect(screen.queryByText(/BOUNDARY ASSIGNMENTS/i)).not.toBeInTheDocument()
            expect(screen.queryByText(/Interactive Plan & Boundary HUD/i)).not.toBeInTheDocument()
        })

        it('renders StructuralFirePage without crashing when initial projects list is empty', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [],
            })
            render(<StructuralFirePage />)
            expect(screen.getByText('MACS Batch & Report Charts')).toBeInTheDocument()
            expect(screen.getByText('Time Equivalence & Reliability')).toBeInTheDocument()
            expect(screen.getByText('Side-by-Side View')).toBeInTheDocument()
            await waitFor(() => {
                expect(screen.getByText('No MACS+ Simulation Batch Linked')).toBeInTheDocument()
            })
        })

        it('renders empty state gracefully when batch is null or undefined without throwing slice error', () => {
            const { unmount } = render(<MacsBatchOverview batch={null} />)
            expect(screen.getByText('No MACS+ Simulation Batch Linked')).toBeInTheDocument()
            expect(screen.getByText(/Run a 10,000-run Monte Carlo batch in the/i)).toBeInTheDocument()
            unmount()

            render(<MacsBatchOverview />)
            expect(screen.getByText('No MACS+ Simulation Batch Linked')).toBeInTheDocument()
        })

        it('renders the header with All Projects link and rich project switcher', async () => {
            const project = {
                id: 'proj-1',
                name: 'Bay 3 Logistics',
                mode: 'timeEq',
                settings: {
                    macsBatch: { total_runs: 10000, reliability_percent: 99.4 },
                },
                floors: [],
            }
            globalThis.fetch.mockImplementation(async (url) => {
                if (String(url).includes('/projects?mode=timeEq')) {
                    return { ok: true, status: 200, json: async () => [project] }
                }
                return { ok: true, status: 200, json: async () => project }
            })
            render(<StructuralFirePage />)

            expect(screen.getByText('Structural Fire Assessment')).toBeInTheDocument()
            expect(screen.getByText('All Projects')).toBeInTheDocument()

            // Open rich project switcher
            await waitFor(() => expect(screen.getByText('Bay 3 Logistics')).toBeInTheDocument())
            fireEvent.click(screen.getByText('Bay 3 Logistics'))

            // Filter input and shortcuts are shown
            expect(screen.getByPlaceholderText('Filter assessments...')).toBeInTheDocument()
            expect(screen.getByText('+ New Assessment')).toBeInTheDocument()
        })

        it('consumes ?handoff query parameter, creates project and loads it into StructuralFirePage', async () => {
            const handoffRun = {
                section: 'UB 406x178x74',
                critical_temp: 590,
                section_factor: 155,
                label: 'Test Handoff Project',
            }
            const handoffResponse = {
                handoff_id: 'handoff-uuid-1',
                run: handoffRun,
            }
            const createdProject = {
                id: 'created-proj-1',
                name: 'Test Handoff Project',
                mode: 'timeEq',
                settings: {},
                floors: [],
            }

            globalThis.fetch.mockImplementation(async (url, opts) => {
                const u = String(url)
                if (u.includes('/handoffs/')) {
                    return { ok: true, status: 200, json: async () => handoffResponse }
                }
                if (u.endsWith('/projects') && opts?.method === 'POST') {
                    return { ok: true, status: 201, json: async () => createdProject }
                }
                if (u.includes('/projects/created-proj-1')) {
                    return { ok: true, status: 200, json: async () => createdProject }
                }
                if (u.includes('/projects?mode=timeEq')) {
                    return { ok: true, status: 200, json: async () => [] }
                }
                return { ok: true, status: 200, json: async () => [] }
            })

            const originalSearch = window.location.search
            window.history.pushState({}, '', '/structural-fire?handoff=handoff-uuid-1')

            try {
                render(<StructuralFirePage />)
                await waitFor(() => {
                    expect(screen.getByText('Test Handoff Project')).toBeInTheDocument()
                })
            } finally {
                window.history.pushState({}, '', originalSearch || '/')
            }
        })
    })

    describe('CompartmentMiniMap', () => {
        it('renders walls and boundary assignments without Side A dotted line or Side A badge', () => {
            const geoPoints = [
                {
                    comments: 'obstruction',
                    finalPoints: [
                        { x: 0, y: 0 },
                        { x: 10, y: 0 },
                        { x: 10, y: 6 },
                        { x: 0, y: 6 },
                        { x: 0, y: 0 },
                    ],
                },
                {
                    comments: 'opening',
                    finalPoints: [
                        { x: 2, y: 0 },
                        { x: 4, y: 0 },
                    ],
                },
            ]
            render(
                <CompartmentMiniMap
                    geoPoints={geoPoints}
                    inputs={{ compartmentHeight: 3.15 }}
                    selectedMacsRun={null}
                />
            )

            // Should show Wall 1 and Opening 1
            expect(screen.getByText(/Wall 1/i)).toBeInTheDocument()
            expect(screen.getByText(/Opening 1/i)).toBeInTheDocument()

            // Should NOT show Side A anywhere in the interactive image or boundary assignments
            expect(screen.queryByText(/Side A/i)).not.toBeInTheDocument()
            expect(screen.queryByText(/MACS Gov/i)).not.toBeInTheDocument()
        })
    })

    describe('StructuralProjectCard & Status Badges', () => {
        it('displays governing section, critical temp, and dual status badges before Time Eq runs', () => {
            const project = {
                id: 'p-test-card',
                name: 'California Drive Second Floor',
                created_by: 'Ian',
                updated_at: new Date().toISOString(),
                settings: {
                    macsBatch: {
                        name: 'Batch 1',
                        project_name: 'California Drive Second Floor',
                        run_count: 10000,
                        pass_count: 9990,
                        fail_count: 10,
                        reliability_percent: 99.9,
                        governing_section: 'UB_406x140x39',
                        critical_temp: 533,
                    },
                },
                floors: [],
            }

            render(
                <StructuralProjectCard
                    project={project}
                    onOpen={vi.fn()}
                    onOpenCanvas={vi.fn()}
                    onRename={vi.fn()}
                    onDelete={vi.fn()}
                    timeAgo={() => '10m ago'}
                />
            )

            // Governing Section and Critical Temp must display
            expect(screen.getAllByText('UB_406x140x39').length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText('533°C')).toBeInTheDocument()

            // MACS badge and Time Eq badge must both be present
            expect(screen.getByText('MACS: 10,000 Runs (99.9%)')).toBeInTheDocument()
            expect(screen.getByText('Time Eq: Not run')).toBeInTheDocument()
        })

        it('displays calculated Time Eq badge when timeEqResult exists', () => {
            const project = {
                id: 'p-calculated',
                name: 'Office Tower Project',
                created_by: 'Ian',
                updated_at: new Date().toISOString(),
                settings: {
                    macsBatch: {
                        run_count: 10000,
                        pass_count: 10000,
                        reliability_percent: 100,
                        governing_section: 'UB_457x191x82',
                        critical_temp: 631,
                    },
                    timeEqResult: {
                        reliabilityPercent: 99.8,
                        time_equiv: 45,
                    },
                },
                floors: [],
            }

            render(
                <StructuralProjectCard
                    project={project}
                    onOpen={vi.fn()}
                    onOpenCanvas={vi.fn()}
                    onRename={vi.fn()}
                    onDelete={vi.fn()}
                    timeAgo={() => 'Just now'}
                />
            )

            expect(screen.getAllByText('UB_457x191x82').length).toBeGreaterThanOrEqual(1)
            expect(screen.getByText('631°C')).toBeInTheDocument()
            expect(screen.getByText('Time Eq: 99.8% Rel.')).toBeInTheDocument()
        })
    })
})
