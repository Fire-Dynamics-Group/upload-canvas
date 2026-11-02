// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MacsBanner from '../Components/MacsBanner'
import useStore from '../store/useStore'

describe('MacsBanner', () => {
  beforeEach(() => {
    useStore.setState({
      macsRuns: [],
      macsNotice: null,
      timeEqInputs: {
        criticalTemp: 500,
        sectionFactor: 120,
        section: 'UB 305x165x40',
        exposure: 'three_sided',
      },
    })
  })

  it('renders nothing when no runs and no notice', () => {
    const { container } = render(<MacsBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders notice when macsNotice is set', () => {
    useStore.setState({
      macsNotice: { type: 'error', message: 'MACS handoff not found' },
    })
    render(<MacsBanner />)
    expect(screen.getByText(/MACS handoff not found/i)).toBeInTheDocument()
  })

  it('renders prompt when newest MACs run differs from inputs in use', () => {
    const newerRun = {
      id: 'r-new',
      run_id: 'uuid-new',
      critical_temp: 560,
      section_factor: 145,
      section: 'UB 457x191x82',
      exposure: 'four_sided',
      governing_side: 'web',
      client_timestamp: '2026-11-02T13:30:00Z',
    }
    useStore.setState({
      macsRuns: [newerRun],
      timeEqInputs: {
        criticalTemp: 500,
        sectionFactor: 120,
        section: 'UB 305x165x40',
        exposure: 'three_sided',
      },
    })

    render(<MacsBanner />)
    expect(screen.getByText(/New MACs results/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Use these/i })).toBeInTheDocument()
  })

  it('updates inputs only when user clicks Use these', () => {
    const newerRun = {
      id: 'r-new',
      run_id: 'uuid-new',
      critical_temp: 580,
      section_factor: 150,
      section: 'UB 457x191x82',
      exposure: 'three_sided',
      governing_side: 'bottom_flange',
      client_timestamp: '2026-11-02T13:30:00Z',
    }
    useStore.setState({
      macsRuns: [newerRun],
      timeEqInputs: {
        criticalTemp: 500,
        sectionFactor: 120,
        section: 'UB 305x165x40',
      },
    })

    render(<MacsBanner />)
    const button = screen.getByRole('button', { name: /Use these/i })
    fireEvent.click(button)

    const updated = useStore.getState().timeEqInputs
    expect(updated.criticalTemp).toBe(580)
    expect(updated.sectionFactor).toBe(150)
    expect(updated.section).toBe('UB 457x191x82')
  })

  it('dismisses the banner when Dismiss is clicked', () => {
    const newerRun = {
      id: 'r-new',
      run_id: 'uuid-new',
      critical_temp: 580,
      section_factor: 150,
      client_timestamp: '2026-11-02T13:30:00Z',
    }
    useStore.setState({
      macsRuns: [newerRun],
      timeEqInputs: { criticalTemp: 500, sectionFactor: 120 },
    })

    render(<MacsBanner />)
    const dismiss = screen.getByRole('button', { name: /Dismiss/i })
    fireEvent.click(dismiss)

    expect(screen.queryByText(/New MACs results/i)).not.toBeInTheDocument()
  })
})
