// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import useStore from '../store/useStore'
import Home from '../pages/index'
import StructuralFirePage from '../pages/structural-fire'
import TimeEqWorkspace from '../Components/StructuralFire/TimeEqWorkspace'
import { clearHandoffCreateLocks } from '../utils/macsHandoff'

const routerState = vi.hoisted(() => ({
  query: {},
  replace: vi.fn(),
  push: vi.fn(),
  pathname: '/',
}))

vi.mock('next/router', () => ({
  useRouter: () => routerState,
}))

vi.mock('next/image', () => ({
  default: (props) => <img alt={props.alt || ''} />,
}))

vi.mock('next/link', () => ({
  default: ({ href, children }) => <a href={href}>{children}</a>,
}))

vi.mock('pdfjs-dist/webpack', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0, getPage: async () => { throw new Error('no page') } }) }),
}))

const HANDOFF_RUN = {
  run_id: 'run-1',
  critical_temp: 640,
  section_factor: 160,
  section: 'UB 533x210x82',
  exposure: '3-sided',
  governing_side: 'B',
  label: 'Bay 2',
  windows_user: 'ian',
  outputs: { macs_batch: { name: 'Bay 2 batch', run_count: 25 } },
}

const CREATED_PROJECT = {
  id: 'proj-created',
  name: 'Bay 2',
  mode: 'timeEq',
  floors: [],
  settings: {
    timeEqInputs: {
      criticalTemp: 640,
      sectionFactor: 160,
      section: 'UB 533x210x82',
      macsRunId: 'run-1',
    },
    macsBatch: { name: 'Bay 2 batch', run_count: 25 },
  },
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function otherProjectInputs() {
  return {
    criticalTemp: 111,
    sectionFactor: 99,
    section: 'OTHER SECTION',
    exposure: '4-sided',
  }
}

describe('handoff prefill survives onto the PDF upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearHandoffCreateLocks()
    sessionStorage.clear()
    localStorage.clear()
    routerState.query = {}
    routerState.pathname = '/'
    window.alert = vi.fn()
    window.history.pushState({}, '', '/')
    useStore.setState({
      currentMode: 'timeEq',
      projectId: 'proj-other',
      floorId: 'floor-other',
      projectName: null,
      timeEqInputs: otherProjectInputs(),
      macsBatch: { name: 'other-batch', run_count: 3 },
      timeEqResult: { teq: 1 },
      elements: [{ id: 1, type: 'line', points: [0, 0, 1, 1], comments: 'obstruction' }],
      macsRuns: [],
      macsNotice: null,
      handoffId: null,
    })
    globalThis.fetch = vi.fn(async () => jsonResponse({ detail: 'unexpected' }, 500))
  })

  it('hydrates a floor-less project before autosave can post another project', async () => {
    const project = {
      id: 'proj-floorless',
      name: 'Handoff Beam',
      mode: 'timeEq',
      floors: [],
      settings: {
        timeEqInputs: {
          criticalTemp: 620,
          sectionFactor: 155,
          section: 'UB 406x178x74',
          exposure: '4-sided',
          macsRunId: 'run-9',
        },
        macsBatch: { name: 'Batch A', run_count: 12 },
      },
    }
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/macs-runs')) return jsonResponse([])
      if (u.includes('/projects/proj-floorless/save')) return jsonResponse({ id: project.id })
      if (u.includes('/projects/proj-floorless')) return jsonResponse(project)
      return jsonResponse({ detail: `unhandled ${opts?.method || 'GET'} ${u}` }, 500)
    })
    routerState.query = { project: 'proj-floorless' }
    window.history.pushState({}, '', '/?project=proj-floorless')

    render(<Home />)

    await waitFor(() => {
      expect(useStore.getState().projectId).toBe('proj-floorless')
      expect(useStore.getState().timeEqInputs).toMatchObject({
        criticalTemp: 620,
        sectionFactor: 155,
        section: 'UB 406x178x74',
        exposure: '4-sided',
      })
      expect(useStore.getState().macsBatch).toEqual({ name: 'Batch A', run_count: 12 })
    })
    expect(useStore.getState().timeEqInputs.criticalTemp).not.toBe(111)
    expect(useStore.getState().timeEqInputs.section).not.toBe('OTHER SECTION')
    expect(screen.getByText('Upload the same PDF to continue')).toBeInTheDocument()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2300))
    })

    const saves = globalThis.fetch.mock.calls.filter((call) => String(call[0]).includes('/save'))
    for (const [, opts] of saves) {
      const body = JSON.parse(opts.body)
      expect(body.settings.timeEqInputs.criticalTemp).toBe(620)
      expect(body.settings.timeEqInputs.section).toBe('UB 406x178x74')
      expect(body.settings.macsBatch).toEqual({ name: 'Batch A', run_count: 12 })
      expect(body.settings.timeEqInputs.section).not.toBe('OTHER SECTION')
    }
  }, 10000)

  it('applies the handoff run and opens the PDF upload with those inputs intact', async () => {
    routerState.query = { handoff: 'h-1' }
    window.history.pushState({}, '', '/?handoff=h-1')
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/handoffs/h-1')) return jsonResponse({ handoff_id: 'h-1', run: HANDOFF_RUN })
      if (opts?.method === 'POST' && /\/projects$/.test(u)) {
        return jsonResponse({ ...CREATED_PROJECT, id: 'proj-duplicate', claimed_project_id: 'proj-owner' }, 201)
      }
      if (u.includes('/save')) return jsonResponse({ id: 'proj-owner' })
      if (u.includes('/macs-runs')) return jsonResponse([])
      if (u.includes('/projects/proj-owner')) return jsonResponse({ ...CREATED_PROJECT, id: 'proj-owner' })
      return jsonResponse({ detail: `unhandled ${opts?.method || 'GET'} ${u}` }, 500)
    })

    const first = render(<StrictMode><Home /></StrictMode>)
    await waitFor(() => {
      expect(routerState.replace).toHaveBeenCalled()
    })
    const creates = globalThis.fetch.mock.calls.filter((call) => call[1]?.method === 'POST' && /\/projects$/.test(String(call[0])))
    expect(creates).toHaveLength(1)
    const createdBody = JSON.parse(creates[0][1].body)
    expect(createdBody.settings.timeEqInputs.exposure).toBe('3-sided')
    expect(createdBody.settings.timeEqInputs.memberProtection).toBe('unprotected')
    const saved = globalThis.fetch.mock.calls.find((call) => String(call[0]).includes('/save'))
    const savedBody = JSON.parse(saved[1].body)
    expect(savedBody.settings.timeEqInputs.exposure).toBe('3-sided')
    expect(savedBody.settings.timeEqInputs.memberProtection).toBe('unprotected')
    expect(String(routerState.replace.mock.calls.at(-1)[0])).toBe('/?project=proj-owner')
    expect(String(routerState.replace.mock.calls.at(-1)[0])).not.toContain('proj-duplicate')
    expect(String(routerState.replace.mock.calls.at(-1)[0])).not.toContain('/structural-fire')

    first.unmount()
    routerState.query = { project: 'proj-owner' }
    window.history.pushState({}, '', '/?project=proj-owner')
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Upload the same PDF to continue')).toBeInTheDocument()
    })
    expect(screen.getByText(/UB 533x210x82/)).toBeInTheDocument()
    expect(screen.getByText(/640°C/)).toBeInTheDocument()
    expect(screen.getByText(/3-sided/)).toBeInTheDocument()
    expect(useStore.getState().timeEqInputs).toMatchObject({
      criticalTemp: 640,
      sectionFactor: 160,
      section: 'UB 533x210x82',
      exposure: '3-sided',
    })
    expect(useStore.getState().macsBatch).toEqual({ name: 'Bay 2 batch', run_count: 25 })
    expect(useStore.getState().timeEqInputs.criticalTemp).not.toBe(111)
    expect(useStore.getState().timeEqInputs.memberProtection).toBe('unprotected')
  })

  it('does not present calculator defaults as the handoff project values', () => {
    const { rerender } = render(
      <TimeEqWorkspace
        project={{
          id: 'p-handoff',
          name: 'Site Plan Time Eq',
          settings: {
            timeEqInputs: {
              criticalTemp: 620,
              sectionFactor: 140,
              section: 'UB 457x191x82',
            },
          },
        }}
        floorDetail={{ elements: [] }}
      />
    )
    expect(screen.getByLabelText(/Occupancy/)).toHaveValue('')
    expect(screen.getByLabelText(/Fire Resistance Period/)).toHaveValue('')
    expect(screen.getByLabelText(/Simulations/)).toHaveValue(null)
    expect(screen.getByLabelText(/Exposure/)).toHaveValue('')
    expect(screen.getByRole('radio', { name: /^Protected$/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Unprotected/ })).not.toBeChecked()
    expect(screen.getByDisplayValue('620')).toBeInTheDocument()

    rerender(
      <TimeEqWorkspace
        project={{
          id: 'p-stored',
          name: 'Site Plan Time Eq',
          settings: {
            timeEqInputs: {
              criticalTemp: 620,
              sectionFactor: 140,
              section: 'UB 457x191x82',
              exposure: '4-sided',
              memberProtection: 'unprotected',
            },
          },
        }}
        floorDetail={{ elements: [] }}
      />
    )
    expect(screen.getByLabelText(/Exposure/)).toHaveValue('4-sided')
    expect(screen.getByRole('radio', { name: /Unprotected/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Protected$/ })).not.toBeChecked()
  })

  it('opens the claimed project when createProject returns 409', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/handoffs/h-claimed')) return jsonResponse({ handoff_id: 'h-claimed', run: HANDOFF_RUN })
      if (opts?.method === 'POST' && /\/projects$/.test(u)) {
        return jsonResponse({
          detail: { message: 'Handoff already claimed', claimed_by_project_id: 'proj-claimed' },
        }, 409)
      }
      return jsonResponse({ detail: 'unexpected' }, 500)
    })
    routerState.query = { handoff: 'h-claimed' }
    window.history.pushState({}, '', '/?handoff=h-claimed')

    render(<Home />)

    await waitFor(() => {
      expect(routerState.replace).toHaveBeenCalled()
    })
    expect(String(routerState.replace.mock.calls.at(-1)[0])).toBe('/structural-fire?project=proj-claimed')
    expect(screen.queryByText(/Failed to create project: 409/)).not.toBeInTheDocument()
  })

  it('shows the handoff-not-found notice when createProject returns 404', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/handoffs/h-missing')) return jsonResponse({ handoff_id: 'h-missing', run: HANDOFF_RUN })
      if (opts?.method === 'POST' && /\/projects$/.test(u)) {
        return jsonResponse({ detail: 'Handoff not found' }, 404)
      }
      return jsonResponse({ detail: 'unexpected' }, 500)
    })
    routerState.query = { handoff: 'h-missing' }
    window.history.pushState({}, '', '/?handoff=h-missing')

    render(<Home />)
    expect(await screen.findByText('MACS handoff not found.')).toBeInTheDocument()
  })

  it('shows the expired notice when createProject returns 410', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/handoffs/h-old')) return jsonResponse({ handoff_id: 'h-old', run: HANDOFF_RUN })
      if (opts?.method === 'POST' && /\/projects$/.test(u)) {
        return jsonResponse({ detail: 'Handoff expired' }, 410)
      }
      return jsonResponse({ detail: 'unexpected' }, 500)
    })
    routerState.query = { handoff: 'h-old' }
    window.history.pushState({}, '', '/?handoff=h-old')

    render(<Home />)
    expect(await screen.findByText(/MACS handoff has expired/)).toBeInTheDocument()
  })

  it('applies the handoff run on the assessment entry and leaves for the PDF upload', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => {
      const u = String(url)
      if (u.includes('/handoffs/h-sf')) return jsonResponse({ handoff_id: 'h-sf', run: HANDOFF_RUN })
      if (opts?.method === 'POST' && /\/projects$/.test(u)) return jsonResponse(CREATED_PROJECT, 201)
      if (u.includes('/projects?mode=timeEq')) return jsonResponse([])
      if (u.includes('/macs-runs')) return jsonResponse([])
      if (u.includes('/projects/proj-created')) return jsonResponse(CREATED_PROJECT)
      return jsonResponse([])
    })
    routerState.query = { handoff: 'h-sf' }
    routerState.pathname = '/structural-fire'
    window.history.pushState({}, '', '/structural-fire?handoff=h-sf')

    render(<StructuralFirePage />)

    await waitFor(() => {
      expect(routerState.replace).toHaveBeenCalled()
    })
    const dest = String(routerState.replace.mock.calls.at(-1)[0])
    expect(dest).toMatch(/\/\?project=proj-created/)
    expect(dest).not.toContain('/structural-fire')
    expect(useStore.getState().timeEqInputs).toMatchObject({
      criticalTemp: 640,
      sectionFactor: 160,
      section: 'UB 533x210x82',
      exposure: '3-sided',
    })
  })
})
