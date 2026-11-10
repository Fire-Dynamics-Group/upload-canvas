// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import StructuralFirePage from '../pages/structural-fire'
import useStore from '../store/useStore'
import { isRunMatchingInputs } from '../utils/macsHandoff'

const routerState = vi.hoisted(() => ({
  query: { project: 'p-1' },
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/router', () => ({
  useRouter: () => routerState,
}))
vi.mock('next/link', () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}))

const older = {
  id: 'run-old',
  run_id: 'run-old',
  section: 'UB 305x165x40',
  exposure: '3-sided',
  critical_temp: 550,
  section_factor: 120,
  received_at: '2026-11-01T10:00:00Z',
  label: 'First run',
}
const newer = {
  id: 'run-new',
  run_id: 'run-new',
  section: 'UB 254x146x31',
  exposure: '4-sided',
  critical_temp: 710,
  section_factor: 140,
  received_at: '2026-11-10T10:20:17Z',
  label: 'Second run',
}
const project = {
  id: 'p-1',
  name: 'Site Plan Time Eq',
  mode: 'timeEq',
  floors: [],
  settings: {
    timeEqInputs: {
      criticalTemp: 550,
      sectionFactor: 120,
      section: 'UB 305x165x40',
      exposure: '3-sided',
    },
  },
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('assessment page shows the MACs record', () => {
  beforeEach(() => {
    routerState.query = { project: 'p-1' }
    useStore.setState({
      projectId: null,
      currentMode: 'fdsGen',
      timeEqInputs: {},
      macsRuns: [],
      macsNotice: null,
    })
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/macs-runs')) return jsonResponse([older, newer])
      if (u.includes('/projects/p-1') && opts?.method !== 'POST') return jsonResponse(project)
      if (u.includes('/projects?mode=timeEq')) return jsonResponse([project])
      if (u.includes('/macs-handoffs/') && opts?.method === 'POST') return jsonResponse({ status: 'claimed' })
      return jsonResponse([])
    })
  })

  it('lists every run newest first and applies a differing run only from the banner', async () => {
    render(<StructuralFirePage />)

    expect(await screen.findByText(/New MACs results/)).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('UB 254x146x31')
    expect(rows[2]).toHaveTextContent('UB 305x165x40')
    expect(useStore.getState().timeEqInputs.criticalTemp).toBe(550)

    const banner = screen.getByText(/New MACs results/).closest('div')
    fireEvent.click(within(banner.parentElement).getByRole('button', { name: 'Use these' }))
    expect(useStore.getState().timeEqInputs.criticalTemp).toBe(710)
    expect(useStore.getState().timeEqInputs.section).toBe('UB 254x146x31')
    expect(useStore.getState().timeEqInputs.exposure).toBe('4-sided')

    fireEvent.click(screen.getByRole('button', { name: 'Time Equivalence & Reliability' }))
    expect(screen.getByDisplayValue('710')).toBeInTheDocument()
  })

  it('claims a handoff onto this project without applying the newest listed run', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/macs-handoffs/') && opts?.method === 'POST') return jsonResponse({ status: 'claimed' })
      if (u.includes('/macs-runs')) {
        return jsonResponse([
          { ...newer, id: 'run-later', critical_temp: 800, section: 'UB 610x229x101' },
          older,
        ])
      }
      if (u.includes('/projects/p-1')) return jsonResponse(project)
      if (u.includes('/projects?mode=timeEq')) return jsonResponse([project])
      return jsonResponse([])
    })
    render(<StructuralFirePage />)
    const input = await screen.findByPlaceholderText(/Paste handoff ID/i)
    fireEvent.change(input, { target: { value: 'h-claim' } })
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }))
    await waitFor(() => {
      expect(globalThis.fetch.mock.calls.some((call) => String(call[0]).includes('/macs-handoffs/h-claim/claim'))).toBe(true)
    })
    expect(useStore.getState().timeEqInputs.criticalTemp).toBe(550)
    expect(useStore.getState().timeEqInputs.section).not.toBe('UB 610x229x101')
  })

  it('does not treat a blank section or exposure as the inputs in use', () => {
    expect(isRunMatchingInputs(
      { critical_temp: 550, section_factor: 120, section: 'UB 305x165x40', exposure: '4-sided' },
      { criticalTemp: 550, sectionFactor: 120, section: 'UB 305x165x40', exposure: '' },
    )).toBe(false)
    expect(isRunMatchingInputs(
      { critical_temp: 550, section_factor: 120, section: '', exposure: '3-sided' },
      { criticalTemp: 550, sectionFactor: 120, section: 'UB 305x165x40', exposure: '3-sided' },
    )).toBe(false)
  })
})
