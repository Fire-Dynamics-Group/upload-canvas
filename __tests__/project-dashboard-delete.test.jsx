// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectDashboard from '../Components/ProjectDashboard'
import { listProjects, deleteProject } from '../Components/ApiCalls'

// The dashboard's delete flow is a GitHub-style guard: the Delete button stays
// disabled until the user types the project's exact name. Mock the API layer so
// the flow runs without a server.
vi.mock('../Components/ApiCalls', () => ({
    listProjects: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
}))

const project = {
    id: 'p1', name: 'Crown Wharf', created_by: 'Ian',
    floors: [], updated_at: null, created_at: null, settings: {},
}

const noop = () => {}

describe('ProjectDashboard — delete with type-to-confirm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        listProjects.mockResolvedValue([project])
    })

    it('keeps Delete disabled until the exact name is typed, then deletes and removes the card', async () => {
        deleteProject.mockResolvedValue(true)
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" />)
        await screen.findByText('Crown Wharf')

        fireEvent.click(screen.getByLabelText('Delete project'))
        const deleteBtn = screen.getByText('Delete this project')
        expect(deleteBtn.disabled).toBe(true)

        const input = screen.getByPlaceholderText('Crown Wharf')
        fireEvent.change(input, { target: { value: 'crown' } }) // wrong (case)
        expect(deleteBtn.disabled).toBe(true)

        fireEvent.change(input, { target: { value: 'Crown Wharf' } }) // exact
        expect(deleteBtn.disabled).toBe(false)

        fireEvent.click(deleteBtn)
        await waitFor(() => expect(deleteProject).toHaveBeenCalledWith('p1'))
        await waitFor(() => expect(screen.queryByText('Crown Wharf')).toBeNull())
    })

    it('does not delete when the typed name does not match', async () => {
        render(<ProjectDashboard onSelectProject={noop} onNewProject={noop} userName="Ian" />)
        await screen.findByText('Crown Wharf')

        fireEvent.click(screen.getByLabelText('Delete project'))
        fireEvent.change(screen.getByPlaceholderText('Crown Wharf'), { target: { value: 'wrong' } })
        fireEvent.click(screen.getByText('Delete this project'))

        expect(deleteProject).not.toHaveBeenCalled()
    })
})
