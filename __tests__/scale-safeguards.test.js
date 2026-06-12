import { describe, it, expect } from 'vitest'
import { wouldClobberScale, shouldPromptForScale } from '../utils/scaleSafeguards'

// Issue #18 — two safeguards so a project can't silently end up with no scale
// (the bug that loaded a project with pixelsPerMesh = 1 and therefore no grid,
// since the grid is gated on hasScale = pixelsPerMesh !== 1).

describe('wouldClobberScale (no clobber-to-1 on autosave)', () => {
    it('blocks a save that would persist the unset sentinel (1) over a floor that has elements', () => {
        const payload = {
            floors: [{ pixels_per_mesh: 1, elements: [{ id: 0, type: 'rect' }] }],
        }
        expect(wouldClobberScale(payload)).toBe(true)
    })

    it('allows a real scale to be saved for a floor with elements', () => {
        const payload = {
            floors: [{ pixels_per_mesh: 33.6, elements: [{ id: 0, type: 'rect' }] }],
        }
        expect(wouldClobberScale(payload)).toBe(false)
    })

    it('allows a genuinely new/empty floor with no scale yet (no spurious block)', () => {
        const payload = { floors: [{ pixels_per_mesh: 1, elements: [] }] }
        expect(wouldClobberScale(payload)).toBe(false)
    })

    it('is defensive against a missing/empty payload', () => {
        expect(wouldClobberScale(null)).toBe(false)
        expect(wouldClobberScale({})).toBe(false)
        expect(wouldClobberScale({ floors: [] })).toBe(false)
    })
})

describe('shouldPromptForScale (prompt when unset on load)', () => {
    it('prompts when a loaded floor has elements but an unset scale', () => {
        expect(shouldPromptForScale({ pixelsPerMesh: 1, elementsCount: 5 })).toBe(true)
    })

    it('does not prompt when the scale is set', () => {
        expect(shouldPromptForScale({ pixelsPerMesh: 33.6, elementsCount: 5 })).toBe(false)
    })

    it('does not prompt for a new/empty floor (no elements)', () => {
        expect(shouldPromptForScale({ pixelsPerMesh: 1, elementsCount: 0 })).toBe(false)
    })
})
