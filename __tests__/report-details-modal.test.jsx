// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReportDetailsModal from '../Components/StructuralFire/ReportDetailsModal'

describe('ReportDetailsModal', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('loads existing reportDetails and saves updated fields to project settings', async () => {
        const updatedProject = {
            id: 'proj-1',
            name: 'Apex Hub',
            settings: {
                reportDetails: {
                    client: 'Acme Ltd',
                    location: 'Leeds',
                    reportTitle: 'Fire Resistance Assessment',
                    author: 'Ian Shaw',
                    checkedBy: 'Kevin',
                    verifiedBy: '',
                    targetReliability: 98.2,
                    buildingDescription: 'Two-storey office.',
                },
            },
        }
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => updatedProject,
        })

        const onSaved = vi.fn()
        const onClose = vi.fn()
        const project = {
            id: 'proj-1',
            name: 'Apex Hub',
            settings: {
                reportDetails: {
                    client: 'Old Client',
                    location: 'York',
                },
            },
        }

        render(
            <ReportDetailsModal
                isOpen={true}
                onClose={onClose}
                project={project}
                onSaved={onSaved}
            />
        )

        const clientInput = screen.getByLabelText(/Client Name/i)
        expect(clientInput.value).toBe('Old Client')
        fireEvent.change(clientInput, { target: { value: 'Acme Ltd' } })
        fireEvent.change(screen.getByLabelText(/Site Location/i), { target: { value: 'Leeds' } })
        fireEvent.change(screen.getByLabelText(/Author/i), { target: { value: 'Ian Shaw' } })

        fireEvent.click(screen.getByRole('button', { name: /Save Report Details/i }))

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedProject))
        expect(onClose).toHaveBeenCalled()

        const fetchCall = globalThis.fetch.mock.calls[0]
        expect(fetchCall[0]).toContain('/projects/proj-1')
        const sentBody = JSON.parse(fetchCall[1].body)
        expect(sentBody.settings.reportDetails.client).toBe('Acme Ltd')
        expect(sentBody.settings.reportDetails.location).toBe('Leeds')
        expect(sentBody.settings.reportDetails.author).toBe('Ian Shaw')
    })
})
