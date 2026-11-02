import { describe, it, expect } from 'vitest'
import {
  applyMacsRunToInputs,
  isRunMatchingInputs,
  hasNewerMacsRun,
} from '../utils/macsHandoff'

describe('MACS Handoff utilities', () => {
  const sampleRun = {
    id: 'r-1',
    run_id: 'macs-uuid-1',
    critical_temp: 545.5,
    section_factor: 135.2,
    section: 'UB 457x191x82',
    exposure: 'three_sided',
    governing_side: 'bottom_flange',
    client_timestamp: '2026-11-02T12:00:00Z',
    windows_user: 'ian',
    machine_name: 'CAD-PC',
    label: 'Beam B1',
  }

  describe('applyMacsRunToInputs', () => {
    it('pre-fills critical temp, section factor, section, exposure, sets calcType to reliability and memberProtection to unprotected', () => {
      const existing = {
        calcType: 'deterministic',
        fireResistancePeriod: 60,
        memberProtection: 'protected',
      }
      const updated = applyMacsRunToInputs(sampleRun, existing)
      expect(updated.calcType).toBe('reliability')
      expect(updated.memberProtection).toBe('unprotected')
      expect(updated.criticalTemp).toBe(545.5)
      expect(updated.sectionFactor).toBe(135.2)
      expect(updated.section).toBe('UB 457x191x82')
      expect(updated.exposure).toBe('three_sided')
      expect(updated.governingSide).toBe('bottom_flange')
      expect(updated.macsRunId).toBe('macs-uuid-1')
      expect(updated.fireResistancePeriod).toBe(60) // preserves other inputs
    })
  })

  describe('isRunMatchingInputs', () => {
    it('returns true when criticalTemp, sectionFactor, section and exposure match', () => {
      const inputs = {
        criticalTemp: '545.5',
        sectionFactor: 135.2,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      }
      expect(isRunMatchingInputs(sampleRun, inputs)).toBe(true)
    })

    it('returns false when critical temp differs', () => {
      const inputs = {
        criticalTemp: 600,
        sectionFactor: 135.2,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      }
      expect(isRunMatchingInputs(sampleRun, inputs)).toBe(false)
    })

    it('returns false when section factor differs', () => {
      const inputs = {
        criticalTemp: 545.5,
        sectionFactor: 180,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      }
      expect(isRunMatchingInputs(sampleRun, inputs)).toBe(false)
    })
  })

  describe('hasNewerMacsRun', () => {
    it('returns the newest run if it differs from current inputs', () => {
      const newerRun = {
        ...sampleRun,
        id: 'r-2',
        critical_temp: 580,
        client_timestamp: '2026-11-02T14:00:00Z',
      }
      const runs = [newerRun, sampleRun]
      const currentInputs = {
        criticalTemp: 545.5,
        sectionFactor: 135.2,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      }
      const newer = hasNewerMacsRun(runs, currentInputs)
      expect(newer).toBe(newerRun)
    })

    it('returns null if newest run matches current inputs', () => {
      const runs = [sampleRun]
      const currentInputs = {
        criticalTemp: 545.5,
        sectionFactor: 135.2,
        section: 'UB 457x191x82',
        exposure: 'three_sided',
      }
      expect(hasNewerMacsRun(runs, currentInputs)).toBe(null)
    })

    it('returns null if runs array is empty', () => {
      expect(hasNewerMacsRun([], { criticalTemp: 500 })).toBe(null)
      expect(hasNewerMacsRun(null, { criticalTemp: 500 })).toBe(null)
    })
  })
})
