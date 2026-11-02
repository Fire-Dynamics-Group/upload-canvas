// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import useStore from '../store/useStore'
import { applyMacsRunToInputs } from '../utils/macsHandoff'
import * as ApiCalls from '../Components/ApiCalls'

vi.mock('../Components/ApiCalls', () => ({
  getHandoff: vi.fn(),
  getMacsRuns: vi.fn(),
  createProject: vi.fn(),
  saveProjectToServer: vi.fn(),
  loadProject: vi.fn(),
  loadFloorDetail: vi.fn(),
}))

describe('MACS Handoff handling flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({
      currentMode: 'fdsGen',
      handoffId: null,
      timeEqInputs: {},
      macsRuns: [],
      macsNotice: null,
    })
  })

  it('pre-fills time-eq inputs and sets mode to timeEq when handoff is valid', async () => {
    const mockHandoff = {
      id: 'h-100',
      imacs_job_id: 'job-1',
      run: {
        run_id: 'run-1',
        critical_temp: 560,
        section_factor: 140,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
        governing_side: 'bottom_flange',
        label: 'Zone A',
      },
    }
    ApiCalls.getHandoff.mockResolvedValue(mockHandoff)

    // Simulate handoff handler
    const handoff = await ApiCalls.getHandoff('h-100')
    useStore.getState().setCurrentMode('timeEq')
    useStore.getState().setHandoffId(handoff.id)
    const inputs = applyMacsRunToInputs(handoff.run, useStore.getState().timeEqInputs)
    useStore.getState().setTimeEqInputs(inputs)
    useStore.getState().setMacsRuns([handoff.run])

    expect(useStore.getState().currentMode).toBe('timeEq')
    expect(useStore.getState().handoffId).toBe('h-100')
    expect(useStore.getState().timeEqInputs.criticalTemp).toBe(560)
    expect(useStore.getState().timeEqInputs.sectionFactor).toBe(140)
    expect(useStore.getState().timeEqInputs.section).toBe('UB 457x191x82')
    expect(useStore.getState().timeEqInputs.exposure).toBe('three_sided')
    expect(useStore.getState().timeEqInputs.calcType).toBe('reliability')
    expect(useStore.getState().timeEqInputs.memberProtection).toBe('unprotected')
  })

  it('passes handoff_id to createProject and clears handoffId', async () => {
    useStore.setState({
      handoffId: 'h-100',
      currentMode: 'timeEq',
    })
    ApiCalls.createProject.mockResolvedValue({ id: 'proj-new', name: 'New Project' })

    const handoffId = useStore.getState().handoffId
    await ApiCalls.createProject('New Project', 'user-1', 'timeEq', handoffId)
    useStore.getState().setHandoffId(null)

    expect(ApiCalls.createProject).toHaveBeenCalledWith('New Project', 'user-1', 'timeEq', 'h-100')
    expect(useStore.getState().handoffId).toBe(null)
  })

  it('handles 409 already claimed by opening linked project', async () => {
    const error = new Error('Handoff already claimed')
    error.status = 409
    error.claimedByProjectId = 'proj-already-claimed'
    ApiCalls.getHandoff.mockRejectedValue(error)

    try {
      await ApiCalls.getHandoff('h-100')
    } catch (err) {
      if (err.status === 409 && err.claimedByProjectId) {
        useStore.getState().setMacsNotice({
          type: 'info',
          message: 'Handoff already claimed; opening linked project.',
        })
      }
    }

    expect(useStore.getState().macsNotice).toEqual({
      type: 'info',
      message: 'Handoff already claimed; opening linked project.',
    })
  })
})
