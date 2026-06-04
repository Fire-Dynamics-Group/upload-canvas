import { describe, it, expect } from 'vitest'
import { shouldShowAutoSprinklers } from '../utils/autoSprinklers'

const manualSprinkler = { id: 's1', type: 'point', comments: 'sprinkler', points: [{ x: 0, y: 0 }] }
const fire = { id: 'f1', type: 'point', comments: 'fire', points: [{ x: 5, y: 5 }] }

describe('shouldShowAutoSprinklers', () => {
    it('shows auto sprinklers in fdsGen mode when sprinklered and no manual sprinklers', () => {
        expect(shouldShowAutoSprinklers('fdsGen', true, [fire])).toBe(true)
    })

    it('does NOT show in radiation mode (only FDS gen)', () => {
        expect(shouldShowAutoSprinklers('radiation', true, [fire])).toBe(false)
    })

    it('does NOT show in timeEq mode', () => {
        expect(shouldShowAutoSprinklers('timeEq', true, [fire])).toBe(false)
    })

    it('does NOT show when not sprinklered', () => {
        expect(shouldShowAutoSprinklers('fdsGen', false, [fire])).toBe(false)
    })

    it('does NOT show when a manual sprinkler already exists', () => {
        expect(shouldShowAutoSprinklers('fdsGen', true, [fire, manualSprinkler])).toBe(false)
    })
})
