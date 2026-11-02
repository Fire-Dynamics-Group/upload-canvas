// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MacsRunHistory from '../Components/MacsRunHistory'
import useStore from '../store/useStore'
import * as ApiCalls from '../Components/ApiCalls'

vi.mock('../Components/ApiCalls', () => ({
  claimHandoff: vi.fn(),
  getMacsRuns: vi.fn(),
}))

describe('MacsRunHistory', () => {
  const runs = [
    {
      id: 'r-2',
      run_id: 'uuid-2',
      section: 'UB 533x210x92',
      exposure: 'four_sided',
      critical_temp: 570,
      section_factor: 110,
      governing_side: 'web',
      windows_user: 'ian',
      machine_name: 'WORKSTATION-1',
      client_timestamp: '2026-11-02T15:00:00Z',
      label: 'Main Girder',
    },
    {
      id: 'r-1',
      run_id: 'uuid-1',
      section: 'UB 457x191x82',
      exposure: 'three_sided',
      critical_temp: 540,
      section_factor: 155,
      governing_side: 'bottom_flange',
      windows_user: 'ian',
      machine_name: 'WORKSTATION-1',
      client_timestamp: '2026-11-02T12:00:00Z',
      label: 'Secondary Beam',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({
      projectId: 'proj-123',
      macsRuns: runs,
      timeEqInputs: {
        criticalTemp: 540,
        sectionFactor: 155,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      },
    })
  })

  it('renders runs with section, exposure, critical temp, section factor, who, machine, when, label', () => {
    render(<MacsRunHistory />)

    expect(screen.getByText('UB 533x210x92')).toBeInTheDocument()
    expect(screen.getByText('four_sided')).toBeInTheDocument()
    expect(screen.getByText('570 °C')).toBeInTheDocument()
    expect(screen.getByText('110 m⁻¹')).toBeInTheDocument()
    expect(screen.getByText('Main Girder')).toBeInTheDocument()

    expect(screen.getByText('UB 457x191x82')).toBeInTheDocument()
    expect(screen.getByText('three_sided')).toBeInTheDocument()
    expect(screen.getByText('540 °C')).toBeInTheDocument()
    expect(screen.getByText('155 m⁻¹')).toBeInTheDocument()
    expect(screen.getByText('Secondary Beam')).toBeInTheDocument()
  })

  it('indicates which run current time-eq inputs used', () => {
    render(<MacsRunHistory />)
    const inUseBadge = screen.getByText('In use')
    expect(inUseBadge).toBeInTheDocument()
  })

  it('allows applying another run from history to current inputs', () => {
    render(<MacsRunHistory />)
    const applyButtons = screen.getAllByRole('button', { name: /Use these/i })
    expect(applyButtons.length).toBeGreaterThan(0)

    fireEvent.click(applyButtons[0]) // click apply on r-2
    const inputs = useStore.getState().timeEqInputs
    expect(inputs.criticalTemp).toBe(570)
    expect(inputs.sectionFactor).toBe(110)
    expect(inputs.section).toBe('UB 533x210x92')
  })

  it('allows claiming a handoff onto the current project', async () => {
    ApiCalls.claimHandoff.mockResolvedValue({ status: 'claimed' })
    ApiCalls.getMacsRuns.mockResolvedValue([
      {
        id: 'r-3',
        critical_temp: 610,
        section_factor: 125,
        section: 'UB 610x229x101',
        exposure: 'three_sided',
      },
      ...runs,
    ])

    render(<MacsRunHistory />)
    const input = screen.getByPlaceholderText(/Paste handoff ID/i)
    fireEvent.change(input, { target: { value: 'h-fresh-123' } })

    const claimBtn = screen.getByRole('button', { name: /Claim/i })
    fireEvent.click(claimBtn)

    await waitFor(() => {
      expect(ApiCalls.claimHandoff).toHaveBeenCalledWith('proj-123', 'h-fresh-123')
    })
  })
})
