// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MacsBatchOverview from '../Components/StructuralFire/MacsBatchOverview'

vi.mock('../Components/StructuralFire/MacsCharts', () => ({
    default: function MockMacsCharts({ timeSeries }) {
        return <div data-testid="mock-macs-charts">charts:{timeSeries?.length ?? 0}</div>
    },
}))

vi.mock('../Components/ApiCalls', () => ({
    getMacsBatchSummary: vi.fn(),
    downloadMacsBatchCharts: vi.fn(),
    downloadStructuralFireReport: vi.fn(),
}))

describe('MacsBatchOverview sample runs', () => {
    it('renders Appendix A.1 & A.2 sample runs and opens full-screen detail modal', () => {
        const batch = {
            batch_id: 'batch-10k',
            name: 'Test Batch',
            run_count: 10000,
            pass_count: 9984,
            fail_count: 16,
            error_count: 0,
            reliability_percent: 99.84,
            sample_runs: [
                {
                    run_id: 31676,
                    run_number: 1676,
                    total_runs: 10000,
                    qf: 520,
                    window_percent: 25.0,
                    uf_max: 0.52,
                    outputs: { side_b_critical_temp: 540 },
                    time_series: [{ time_step: 0, time_min: 0, fire_temp: 20 }],
                },
                {
                    run_id: 39965,
                    run_number: 9965,
                    total_runs: 10000,
                    qf: 780,
                    window_percent: 18.0,
                    uf_max: 0.79,
                    outputs: { side_b_critical_temp: 533 },
                    time_series: [{ time_step: 0, time_min: 0, fire_temp: 20 }],
                },
            ],
        }

        render(<MacsBatchOverview projectId="proj-1" batch={batch} />)

        expect(screen.getByText(/A\.1 — Simulation 1,676 of 10,000 \(Run #31676\)/i)).toBeTruthy()
        expect(screen.getByText(/A\.2 — Simulation 9,965 of 10,000 \(Run #39965\)/i)).toBeTruthy()

        const openBtns = screen.getAllByRole('button', { name: /Open full screen/i })
        expect(openBtns).toHaveLength(2)
        fireEvent.click(openBtns[0])

        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeTruthy()
        expect(screen.getByTestId('mock-macs-charts').textContent).toBe('charts:1')

        fireEvent.click(screen.getByRole('button', { name: /Close/i }))
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})
