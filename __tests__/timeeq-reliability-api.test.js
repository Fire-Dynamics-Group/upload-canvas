import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendTimeEqReliabilityData } from '../Components/ApiCalls'

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
})
