// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StructuralProjectCard, { getStructuralCardMetrics, projectsWithMacsRuns } from '../Components/StructuralProjectCard'

function project({ name, timeEqInputs = {}, macsBatch = null, macs_runs = undefined, macsRuns = undefined }) {
    const settings = { timeEqInputs }
    if (macsBatch) settings.macsBatch = macsBatch
    const row = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        mode: 'timeEq',
        created_by: 'Ian',
        created_at: '2026-11-09T12:00:00Z',
        updated_at: '2026-11-09T12:00:00Z',
        floors: [],
        settings,
    }
    if (macs_runs !== undefined) row.macs_runs = macs_runs
    if (macsRuns !== undefined) row.macsRuns = macsRuns
    return row
}

function renderCard(row) {
    render(
        <StructuralProjectCard
            project={row}
            onOpen={() => {}}
            onOpenCanvas={() => {}}
            onRename={() => {}}
            onDelete={() => {}}
            timeAgo={() => '1d ago'}
        />,
    )
}

describe('MACS linked badge requires a real link', () => {
    it('does not treat calculator defaults (500°C / Ap/V 135) as a MACS run', () => {
        const row = project({
            name: 'California Drive',
            timeEqInputs: { criticalTemp: 500, sectionFactor: 135, section: '' },
            macs_runs: [],
        })

        const metrics = getStructuralCardMetrics(row)
        expect(metrics.statusLabel).toBe('Awaiting MACS Data')
        expect(metrics.statusType).toBe('awaiting')
        expect(metrics.statusLabel).not.toBe('MACS Run Linked')

        renderCard(row)
        expect(screen.getByText('Awaiting MACS Data')).toBeInTheDocument()
        expect(screen.queryByText('MACS Run Linked')).not.toBeInTheDocument()
        expect(screen.getByText('500°C')).toBeInTheDocument()
    })

    it('does not treat hand-entered section, critical temp, or section factor as a MACS run', () => {
        const row = project({
            name: 'Swindon 2b Unit 11',
            timeEqInputs: {
                section: 'UB 305x165x40',
                criticalTemp: 620,
                sectionFactor: 140,
            },
            macs_runs: [],
        })

        const metrics = getStructuralCardMetrics(row)
        expect(metrics.statusLabel).toBe('Awaiting MACS Data')
        expect(metrics.statusType).toBe('awaiting')

        renderCard(row)
        expect(screen.getByText('Awaiting MACS Data')).toBeInTheDocument()
        expect(screen.queryByText('MACS Run Linked')).not.toBeInTheDocument()
        expect(screen.getByText('620°C')).toBeInTheDocument()
        expect(screen.getAllByText('UB 305x165x40').length).toBeGreaterThan(0)
    })

    it('does not treat a bare critical temperature or a bare section factor as a link', () => {
        const tempOnly = project({
            name: 'Swindon 2b Unit 8a',
            timeEqInputs: { criticalTemp: 550 },
            macs_runs: [],
        })
        const factorOnly = project({
            name: 'Section factor only',
            timeEqInputs: { sectionFactor: 135 },
            macs_runs: [],
        })

        expect(getStructuralCardMetrics(tempOnly).statusLabel).toBe('Awaiting MACS Data')
        expect(getStructuralCardMetrics(factorOnly).statusLabel).toBe('Awaiting MACS Data')
        expect(getStructuralCardMetrics(tempOnly).statusLabel).not.toBe('MACS Run Linked')
        expect(getStructuralCardMetrics(factorOnly).statusLabel).not.toBe('MACS Run Linked')
    })

    it('shows MACS Run Linked when timeEqInputs.macsRunId is set', () => {
        const row = project({
            name: 'Linked by run id',
            timeEqInputs: {
                macsRunId: 'run-real-1',
                criticalTemp: 590,
                sectionFactor: 150,
                section: 'UB 406x178x74',
            },
            macs_runs: [],
        })

        expect(getStructuralCardMetrics(row).statusLabel).toBe('MACS Run Linked')
        expect(getStructuralCardMetrics(row).statusType).toBe('run-linked')
    })

    it('shows MACS Run Linked when the project has a macs-runs row and no member fields', () => {
        const row = project({
            name: 'Row without member fields',
            timeEqInputs: {},
            macs_runs: [{ id: 'row-1', run_id: 'uuid-row-1', section: 'UB 533x210x92' }],
        })

        expect(getStructuralCardMetrics(row).statusLabel).toBe('MACS Run Linked')
        expect(getStructuralCardMetrics(row).statusType).toBe('run-linked')
    })

    it('shows MACS Batch Linked for a stored batch that has not reported a run count', () => {
        const row = project({
            name: 'Batch only',
            timeEqInputs: {},
            macsBatch: { name: 'Batch 1' },
        })

        expect(getStructuralCardMetrics(row).statusLabel).toBe('MACS Batch Linked')
        expect(getStructuralCardMetrics(row).statusType).toBe('batch-linked')
    })

    it('links a project when the runs fetch returns a macs-runs row', async () => {
        const bare = project({
            name: 'Fetched row',
            timeEqInputs: { criticalTemp: 500, sectionFactor: 135 },
        })
        const [linked] = await projectsWithMacsRuns([bare], async () => [
            { id: 'fetched-1', run_id: 'fetched-1' },
        ])
        expect(getStructuralCardMetrics(linked).statusLabel).toBe('MACS Run Linked')
    })

    it('does not invent a link when the runs fetch fails', async () => {
        const bare = project({
            name: 'Fetch failed',
            timeEqInputs: { criticalTemp: 500, sectionFactor: 135 },
        })
        const [unchanged] = await projectsWithMacsRuns([bare], async () => {
            throw new Error('offline')
        })
        expect(getStructuralCardMetrics(unchanged).statusLabel).toBe('Awaiting MACS Data')
    })

    it('ignores a blank macsRunId and an empty macs-runs list', () => {
        const row = project({
            name: 'Blank id',
            timeEqInputs: { macsRunId: '   ', criticalTemp: 500, sectionFactor: 135 },
            macsRuns: [],
        })

        expect(getStructuralCardMetrics(row).statusLabel).toBe('Awaiting MACS Data')
    })
})
