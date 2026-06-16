// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SidePanel from '../Components/SidePanel'

// SidePanel is the docked, non-modal inspector that replaces the centered
// full-screen input modals — so the popup no longer covers/dims the canvas.
// It must stay a *non-modal* complementary region (no full-screen backdrop that
// blocks the canvas), expose a close affordance, and dock to a chosen side.

describe('SidePanel', () => {
    it('renders its title', () => {
        render(<SidePanel title="FDS Inputs" onClose={() => {}}>body</SidePanel>)
        expect(screen.getByText('FDS Inputs')).toBeTruthy()
    })

    it('renders its children', () => {
        render(<SidePanel title="T" onClose={() => {}}><p>panel body content</p></SidePanel>)
        expect(screen.getByText('panel body content')).toBeTruthy()
    })

    it('calls onClose when the close button is clicked', () => {
        const onClose = vi.fn()
        render(<SidePanel title="T" onClose={onClose}>body</SidePanel>)
        fireEvent.click(screen.getByLabelText('Close'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('is a non-modal complementary region (does not block the canvas like a dialog)', () => {
        render(<SidePanel title="T" onClose={() => {}}>body</SidePanel>)
        expect(screen.getByRole('complementary')).toBeTruthy()
        // A modal dialog would trap/block the page; a docked panel must not.
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('forwards contentRef to its scrollable content (for scroll-position preservation)', () => {
        const ref = { current: null }
        render(<SidePanel title="T" onClose={() => {}} contentRef={ref}><p>x</p></SidePanel>)
        expect(ref.current).not.toBeNull()
        expect(ref.current.textContent).toContain('x')
    })

    it('docks to the right by default and to the left when asked', () => {
        const { rerender } = render(<SidePanel title="T" onClose={() => {}}>body</SidePanel>)
        expect(screen.getByRole('complementary').getAttribute('data-side')).toBe('right')
        rerender(<SidePanel title="T" side="left" onClose={() => {}}>body</SidePanel>)
        expect(screen.getByRole('complementary').getAttribute('data-side')).toBe('left')
    })
})
