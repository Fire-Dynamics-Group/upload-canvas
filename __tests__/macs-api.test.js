import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getHandoff,
  claimHandoff,
  getMacsRuns,
  createProject,
} from '../Components/ApiCalls'

describe('MACS API calls', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getHandoff', () => {
    it('GETs /handoffs/:id and returns parsed handoff object', async () => {
      const mockHandoff = {
        id: 'h-123',
        imacs_job_id: 'job-999',
        run: {
          critical_temp: 540,
          section_factor: 155,
          section: 'UB 457x191x82',
          exposure: 'three_sided',
        },
      }
      globalThis.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockHandoff,
      })

      const res = await getHandoff('h-123')
      expect(res).toEqual(mockHandoff)
      const [url, opts] = globalThis.fetch.mock.calls[0]
      expect(url).toMatch(/\/handoffs\/h-123$/)
      expect(opts.method).toBe('GET')
    })

    it('throws with status code and detail on 404', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Handoff not found' }),
      })

      await expect(getHandoff('h-missing')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('Handoff not found'),
      })
    })

    it('throws with status 409 and claimed_by_project_id when already claimed', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          detail: {
            message: 'Handoff already claimed',
            claimed_by_project_id: 'p-already-claimed',
          },
        }),
      })

      await expect(getHandoff('h-claimed')).rejects.toMatchObject({
        status: 409,
        claimedByProjectId: 'p-already-claimed',
      })
    })

    it('throws with status 410 on expired handoff', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ detail: 'Handoff expired' }),
      })

      await expect(getHandoff('h-expired')).rejects.toMatchObject({
        status: 410,
        message: expect.stringContaining('Handoff expired'),
      })
    })
  })

  describe('claimHandoff', () => {
    it('POSTs /projects/:id/macs-handoffs/:handoff_id/claim', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'claimed', project_id: 'p-1', handoff_id: 'h-1' }),
      })

      const res = await claimHandoff('p-1', 'h-1')
      expect(res.status).toBe('claimed')
      const [url, opts] = globalThis.fetch.mock.calls[0]
      expect(url).toMatch(/\/projects\/p-1\/macs-handoffs\/h-1\/claim$/)
      expect(opts.method).toBe('POST')
    })
  })

  describe('getMacsRuns', () => {
    it('GETs /projects/:id/macs-runs and returns run list', async () => {
      const runs = [
        { id: 'r-2', critical_temp: 560, client_timestamp: '2026-11-02T12:00:00Z' },
        { id: 'r-1', critical_temp: 520, client_timestamp: '2026-11-02T11:00:00Z' },
      ]
      globalThis.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => runs,
      })

      const res = await getMacsRuns('p-1')
      expect(res).toEqual(runs)
      const [url, opts] = globalThis.fetch.mock.calls[0]
      expect(url).toMatch(/\/projects\/p-1\/macs-runs$/)
      expect(opts.method).toBe('GET')
    })
  })

  describe('createProject with handoff_id', () => {
    it('includes handoff_id in POST body when provided', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'p-new', name: 'Test', handoff_id: 'h-123' }),
      })

      await createProject('Test', 'user-1', 'timeEq', 'h-123')
      const [url, opts] = globalThis.fetch.mock.calls[0]
      expect(url).toMatch(/\/projects$/)
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.handoff_id).toBe('h-123')
      expect(body.name).toBe('Test')
      expect(body.mode).toBe('timeEq')
    })
  })
})
