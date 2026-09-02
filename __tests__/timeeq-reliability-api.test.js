import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendTimeEqReliabilityData, sendTimeEqReliabilityChartsData } from '../Components/ApiCalls'

const POINTS = [
  { id: 0, comments: 'obstruction', finalPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
]

describe('sendTimeEqReliabilityData', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /timeEqReliability with the inputs and returns parsed JSON', async () => {
    const result = { reliability: 0.95, protectionThickness_mm: 16, nSim: 2000 }
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => result })

    const out = await sendTimeEqReliabilityData(POINTS, {
      occupancy: 'Office',
      compartmentHeight: 3.5,
      fireResistancePeriod: 60,
      nSim: 2000,
      openableWidths: [64, 0, 0, 0],
    })

    expect(out).toEqual(result)
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toMatch(/\/timeEqReliability$/)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.occupancy).toBe('Office')
    expect(body.fireResistancePeriod).toBe(60)
    expect(body.openableWidths).toEqual([64, 0, 0, 0])
    expect(body.convertedPoints).toEqual(POINTS)
  })

  it('applies factor defaults (0.8 combustibility, 0.65 sprinkler) when not overridden', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await sendTimeEqReliabilityData(POINTS, { occupancy: 'Office', compartmentHeight: 3, fireResistancePeriod: 60 })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.combustionFactor).toBe(0.8)
    expect(body.sprinklerFactor).toBe(0.65)
    expect(body.nSim).toBe(2000)
  })

  it('throws with the backend detail on a non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 400, json: async () => ({ detail: "Occupancy 'X' not found" }),
    })
    await expect(
      sendTimeEqReliabilityData(POINTS, { occupancy: 'X', compartmentHeight: 3, fireResistancePeriod: 60 })
    ).rejects.toThrow(/not found/)
  })

  it('sends unprotected=true without a fire resistance period', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reliability: 0.4, nFailed: 120, nSim: 200, criticalTemp: 550, unprotected: true }),
    })
    await sendTimeEqReliabilityData(POINTS, {
      occupancy: 'Office',
      compartmentHeight: 3.5,
      unprotected: true,
      criticalTemp: 550,
      nSim: 200,
    })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.unprotected).toBe(true)
    expect(body.criticalTemp).toBe(550)
    expect(body.fireResistancePeriod).toBeUndefined()
  })

  it('does not send unprotected for the default protected path', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await sendTimeEqReliabilityData(POINTS, {
      occupancy: 'Office', compartmentHeight: 3, fireResistancePeriod: 60,
    })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.unprotected).toBe(false)
    expect(body.fireResistancePeriod).toBe(60)
  })
})

describe('sendTimeEqReliabilityChartsData', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /timeEqReliabilityCharts with the seed and returns parsed JSON', async () => {
    const result = {
      reliability: 0.9982, nFailed: 18, nSim: 10000, seed: 42,
      charts: { steelTempSpaghetti: 'aGVsbG8=', passFailScatter: 'd29ybGQ=' },
    }
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => result })

    const out = await sendTimeEqReliabilityChartsData(POINTS, {
      occupancy: 'Office',
      compartmentHeight: 3.15,
      fireResistancePeriod: 90,
      nSim: 10000,
      seed: 42,
    })

    expect(out).toEqual(result)
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toMatch(/\/timeEqReliabilityCharts$/)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.seed).toBe(42)
    expect(body.fireResistancePeriod).toBe(90)
    expect(body.convertedPoints).toEqual(POINTS)
  })

  it('sends the same body shape as the reliability call (unprotected, no FR period)', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await sendTimeEqReliabilityChartsData(POINTS, {
      occupancy: 'Office', compartmentHeight: 3.5,
      unprotected: true, criticalTemp: 550, nSim: 200, seed: 7,
    })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.unprotected).toBe(true)
    expect(body.criticalTemp).toBe(550)
    expect(body.seed).toBe(7)
    expect(body.fireResistancePeriod).toBeUndefined()
  })

  it('throws with the backend detail on a non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 400, json: async () => ({ detail: 'boom' }),
    })
    await expect(
      sendTimeEqReliabilityChartsData(POINTS, {
        occupancy: 'Office', compartmentHeight: 3, fireResistancePeriod: 60,
      })
    ).rejects.toThrow(/boom/)
  })
})
