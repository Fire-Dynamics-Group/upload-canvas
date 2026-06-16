import { describe, it, expect } from 'vitest'
import { describeSaveStatus } from '../utils/saveStatus'

// Issue #3 — persistence failures must not be silent. Project-creation and
// PDF-upload failures (previously only console.error'd) now set a save status
// that the indicator surfaces. describeSaveStatus maps a status to the message
// + tone the indicator renders.

describe('describeSaveStatus', () => {
    it('surfaces a project-creation failure as an error-tone message that says work is not being saved', () => {
        const d = describeSaveStatus('create-failed')
        expect(d.tone).toBe('error')
        expect(d.label.toLowerCase()).toContain("isn't being saved")
    })

    it('surfaces a PDF-upload failure as an error', () => {
        const d = describeSaveStatus('pdf-failed')
        expect(d.tone).toBe('error')
        expect(d.label.toLowerCase()).toContain('pdf')
    })

    it('keeps the existing saving/saved/error states with the right tone', () => {
        expect(describeSaveStatus('saving')).toEqual({ label: 'Saving…', tone: 'pending' })
        expect(describeSaveStatus('saved')).toEqual({ label: 'Saved', tone: 'success' })
        expect(describeSaveStatus('error').tone).toBe('error')
    })

    it('returns null for no status (indicator hidden)', () => {
        expect(describeSaveStatus(null)).toBeNull()
        expect(describeSaveStatus(undefined)).toBeNull()
        expect(describeSaveStatus('something-else')).toBeNull()
    })
})
