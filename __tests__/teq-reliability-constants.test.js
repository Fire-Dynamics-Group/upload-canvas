import { describe, it, expect } from 'vitest'
import {
  MATERIAL_B_VALUES,
  OCCUPANCY_DISTRIBUTIONS,
  GROWTH_RATES,
  wallLengths,
} from '../utils/teqReliabilityConstants'

describe('MATERIAL_B_VALUES mirror the backend (time_eq.py material_b_values)', () => {
  it('matches the sqrt of the tabulated values', () => {
    expect(MATERIAL_B_VALUES.concrete).toBeCloseTo(1741.6199, 3)
    expect(MATERIAL_B_VALUES.brick).toBeCloseTo(1674.8134, 3)
    expect(MATERIAL_B_VALUES.plasterboard).toBeCloseTo(421.4854, 3)
  })
})

describe('OCCUPANCY_DISTRIBUTIONS mirror fire_load_density.csv', () => {
  it('has the 13 fire-load rows (not the Opening Factor row)', () => {
    expect(OCCUPANCY_DISTRIBUTIONS).toHaveLength(13)
    expect(OCCUPANCY_DISTRIBUTIONS.some((o) => o.occupancy === 'Opening Factor')).toBe(false)
  })
  it('keeps Office as Gumbel mean 420 cov 0.3', () => {
    const office = OCCUPANCY_DISTRIBUTIONS.find((o) => o.occupancy === 'Office')
    expect(office).toMatchObject({ type: 'Gumbel type 1', mean: 420, cov: 0.3 })
  })
})

describe('GROWTH_RATES', () => {
  it('maps slow/medium/fast to EC1 t_lim 25/20/15', () => {
    expect(GROWTH_RATES.map((g) => g.tLimMinutes)).toEqual([25, 20, 15])
  })
})

describe('wallLengths', () => {
  it('returns per-segment lengths of the first obstruction', () => {
    const points = [{
      comments: 'obstruction',
      finalPoints: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 13 }, { x: 0, y: 13 }, { x: 0, y: 0 }],
    }]
    expect(wallLengths(points)).toEqual([64, 13, 64, 13])
  })
  it('returns [] when there is no obstruction', () => {
    expect(wallLengths([])).toEqual([])
    expect(wallLengths([{ comments: 'opening', finalPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }])).toEqual([])
  })
})
