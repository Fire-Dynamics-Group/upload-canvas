import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveAs } from 'file-saver'
import {
  reliabilitySamplesCsv,
  downloadReliabilityResultsCsv,
} from '../utils/reliabilityResults'
import { GROWTH_RATES, reliabilityRequestOptionsFromInputs } from '../utils/teqReliabilityConstants'

vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

const SAMPLES = [
  { index: 0, fuelLoad: 420.5, glazingBreakage: 0.85, openingFactor: 0.12, peakSteelTemp: 312.25, failed: false },
  { index: 1, fuelLoad: 610.1, glazingBreakage: 0.05, openingFactor: 0.01, peakSteelTemp: 520.5, failed: true },
]

describe('reliabilitySamplesCsv', () => {
  it('renders a header and one row per sample, glazing as percent', () => {
    const csv = reliabilitySamplesCsv(SAMPLES)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('index,fuel_load_MJm2,glazing_breakage_pct,opening_factor,peak_steel_temp_C,failed')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('0,420.5,85,0.12,312.25,false')
    expect(lines[2]).toBe('1,610.1,5,0.01,520.5,true')
  })
})

describe('downloadReliabilityResultsCsv', () => {
  beforeEach(() => saveAs.mockClear())

  it('saves a csv blob named with the seed', () => {
    downloadReliabilityResultsCsv(SAMPLES, 42)
    expect(saveAs).toHaveBeenCalledTimes(1)
    const [blob, name] = saveAs.mock.calls[0]
    expect(name).toBe('reliability-results-seed42.csv')
    expect(blob.type).toMatch(/text\/csv/)
  })

  it('omits the seed suffix when there is none', () => {
    downloadReliabilityResultsCsv(SAMPLES)
    expect(saveAs.mock.calls[0][1]).toBe('reliability-results.csv')
  })
})

describe('reliabilityRequestOptionsFromInputs', () => {
  const inputs = {
    fireResistancePeriod: 90,
    compartmentHeight: '3.15',
    isSprinklered: false,
    wallProperties: ['concrete', 'brick'],
    floorAndCeilingMaterials: ['concrete', 'plasterboard'],
    mcOccupancy: 'Office',
    nSim: '100',
    growthRate: GROWTH_RATES[0].label,
    combustionFactor: '0.8',
    sprinklerFactor: '0.65',
    sectionFactor: '135',
    criticalTemp: '500',
    customBValue: '',
    openableWidths: ['7.4', '19.2'],
    memberProtection: 'protected',
  }

  it('maps stored inputs to the request options the popup sends', () => {
    const o = reliabilityRequestOptionsFromInputs(inputs)
    expect(o.occupancy).toBe('Office')
    expect(o.compartmentHeight).toBe(3.15)
    expect(o.fireResistancePeriod).toBe(90)
    expect(o.nSim).toBe(100)
    expect(o.openableWidths).toEqual([7.4, 19.2])
    expect(o.roomComposition).toEqual(['concrete', 'concrete', 'brick', 'plasterboard'])
    expect(o.bValue).toBeNull()
    expect(o.sectionFactor).toBe(135)
    expect(o.criticalTemp).toBe(500)
    expect(o.tLimMinutes).toBe(GROWTH_RATES[0].tLimMinutes)
    expect(o.unprotected).toBe(false)
  })

  it('unprotected members drop the FR period and set the flag', () => {
    const o = reliabilityRequestOptionsFromInputs({ ...inputs, memberProtection: 'unprotected' })
    expect(o.unprotected).toBe(true)
    expect(o.fireResistancePeriod).toBeUndefined()
  })

  it('a custom b-value is passed through as a number', () => {
    const o = reliabilityRequestOptionsFromInputs({ ...inputs, customBValue: '1800' })
    expect(o.bValue).toBe(1800)
  })
})
