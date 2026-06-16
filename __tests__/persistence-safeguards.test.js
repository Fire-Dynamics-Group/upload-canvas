import { describe, it, expect } from 'vitest'
import { wouldWipeElements } from '../utils/persistenceSafeguards'

// Guard against the empirically-confirmed destructive autosave: POST /save is a
// delete-then-recreate of the floor, so a save carrying an empty `elements`
// array wipes previously-saved geometry. wouldWipeElements lets the autosave
// caller skip a save that would replace a non-empty saved floor with an empty
// one (a transient in-memory blank), while still allowing legitimate edits.

describe('wouldWipeElements (no empty-save over saved geometry)', () => {
    it('blocks a save with an empty floor when the previous save had elements', () => {
        const previous = { floors: [{ floor_number: 0, elements: [{ element_index: 0 }] }] }
        const payload = { floors: [{ floor_number: 0, elements: [] }] }
        expect(wouldWipeElements(payload, previous)).toBe(true)
    })

    it('allows a save that still carries elements (a real edit)', () => {
        const previous = { floors: [{ floor_number: 0, elements: [{ element_index: 0 }] }] }
        const payload = {
            floors: [{ floor_number: 0, elements: [{ element_index: 0 }, { element_index: 1 }] }],
        }
        expect(wouldWipeElements(payload, previous)).toBe(false)
    })

    it('allows the first-ever save (nothing previously saved to wipe)', () => {
        const payload = { floors: [{ floor_number: 0, elements: [] }] }
        expect(wouldWipeElements(payload, null)).toBe(false)
        expect(wouldWipeElements(payload, undefined)).toBe(false)
    })

    it('allows an empty save when the previous save was also empty', () => {
        const previous = { floors: [{ floor_number: 0, elements: [] }] }
        const payload = { floors: [{ floor_number: 0, elements: [] }] }
        expect(wouldWipeElements(payload, previous)).toBe(false)
    })

    it('is defensive against missing/empty payloads', () => {
        const previous = { floors: [{ floor_number: 0, elements: [{ element_index: 0 }] }] }
        expect(wouldWipeElements(null, previous)).toBe(false)
        expect(wouldWipeElements({}, previous)).toBe(false)
        expect(wouldWipeElements({ floors: [] }, previous)).toBe(false)
    })

    it('matches floors by floor_number, not array position', () => {
        // previous has only floor 0 with elements; payload's floor 1 is empty but
        // there's no previous floor 1 to wipe -> allowed.
        const previous = { floors: [{ floor_number: 0, elements: [{ element_index: 0 }] }] }
        const payload = { floors: [{ floor_number: 1, elements: [] }] }
        expect(wouldWipeElements(payload, previous)).toBe(false)
    })
})
