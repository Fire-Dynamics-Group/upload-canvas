// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScalePopup from '../Components/ScalePopup'

// Issue #17 — a misclicked measurement must be recoverable: the popup needs a
// real Cancel (the previous "Close" was commented out), and issue #19 pre-fills
// the input with the previous length for the "Change length" flow.

describe('ScalePopup', () => {
    it('submits the entered length via handleScaleInput', () => {
        const onSubmit = vi.fn()
        render(<ScalePopup handleScaleInput={onSubmit} onCancel={() => {}} />)
        fireEvent.change(screen.getByPlaceholderText(/length/i), { target: { value: '7.5' } })
        fireEvent.click(screen.getByText('Enter'))
        expect(onSubmit).toHaveBeenCalledWith('7.5')
    })

    it('renders a Cancel button that calls onCancel without submitting (issue #17)', () => {
        const onSubmit = vi.fn()
        const onCancel = vi.fn()
        render(<ScalePopup handleScaleInput={onSubmit} onCancel={onCancel} />)
        fireEvent.click(screen.getByText('Cancel'))
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('pre-fills the input with a provided default length (issue #19 — Change length)', () => {
        render(<ScalePopup handleScaleInput={() => {}} onCancel={() => {}} defaultValue={5} />)
        expect(screen.getByDisplayValue('5')).toBeTruthy()
    })
})
