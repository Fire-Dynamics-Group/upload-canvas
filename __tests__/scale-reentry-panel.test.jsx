// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScaleReentryPanel from '../Components/ScaleReentryPanel'

// Issue #19 — re-entering Set scale on a calibrated project shows the current
// scale and offers Re-measure / Change length / Cancel instead of forcing a
// fresh measurement.

describe('ScaleReentryPanel', () => {
    const props = {
        pixelsPerMesh: 6,
        lengthMeters: 5,
        canChangeLength: true,
        onRemeasure: vi.fn(),
        onChangeLength: vi.fn(),
        onCancel: vi.fn(),
    }

    it('shows the current scale in human terms (1.00 m = N px)', () => {
        render(<ScaleReentryPanel {...props} />)
        expect(screen.getByText(/1\.00 m = 60 px/)).toBeTruthy()
    })

    it('wires the three actions', () => {
        const onRemeasure = vi.fn(), onChangeLength = vi.fn(), onCancel = vi.fn()
        render(<ScaleReentryPanel {...props} onRemeasure={onRemeasure} onChangeLength={onChangeLength} onCancel={onCancel} />)
        fireEvent.click(screen.getByText('Re-measure'))
        fireEvent.click(screen.getByText('Change length'))
        fireEvent.click(screen.getByText('Cancel'))
        expect(onRemeasure).toHaveBeenCalledTimes(1)
        expect(onChangeLength).toHaveBeenCalledTimes(1)
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('disables Change length when there is no stored calibration line (legacy project)', () => {
        render(<ScaleReentryPanel {...props} canChangeLength={false} />)
        expect(screen.getByText('Change length').closest('button').disabled).toBe(true)
    })
})
