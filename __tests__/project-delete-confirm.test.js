import { describe, it, expect } from 'vitest'
import { deleteConfirmationMatches } from '../utils/projectActions'

// GitHub-style destructive-action guard: the Delete button stays disabled until
// the user types the project's exact name. deleteConfirmationMatches is the pure
// gate the modal uses to enable/disable the button.

describe('deleteConfirmationMatches', () => {
    it('matches when the typed text equals the project name', () => {
        expect(deleteConfirmationMatches('Crown Wharf', 'Crown Wharf')).toBe(true)
    })

    it('does not match different text', () => {
        expect(deleteConfirmationMatches('crown', 'Crown Wharf')).toBe(false)
    })

    it('is case-sensitive (like GitHub)', () => {
        expect(deleteConfirmationMatches('crown wharf', 'Crown Wharf')).toBe(false)
    })

    it('tolerates surrounding whitespace in the typed text', () => {
        expect(deleteConfirmationMatches('  Crown Wharf  ', 'Crown Wharf')).toBe(true)
    })

    it('never matches an empty input', () => {
        expect(deleteConfirmationMatches('', 'Crown Wharf')).toBe(false)
        expect(deleteConfirmationMatches('   ', 'Crown Wharf')).toBe(false)
    })

    it('never matches when the project name is missing/blank', () => {
        expect(deleteConfirmationMatches('', '')).toBe(false)
        expect(deleteConfirmationMatches('anything', null)).toBe(false)
        expect(deleteConfirmationMatches(undefined, 'Crown Wharf')).toBe(false)
    })
})
