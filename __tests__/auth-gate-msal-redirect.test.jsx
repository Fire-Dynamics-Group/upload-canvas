// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AuthGate from '../Components/auth/AuthGate'
import { useAuth } from '../lib/auth/AuthContext'

const mockLoginRedirect = vi.fn()
const mockHandleRedirectPromise = vi.fn()
const mockGetActiveAccount = vi.fn()
const mockGetAllAccounts = vi.fn()
const mockSetActiveAccount = vi.fn()
const mockAcquireTokenSilent = vi.fn()
const mockInitialize = vi.fn().mockResolvedValue(undefined)

vi.mock('@azure/msal-browser', () => {
    return {
        PublicClientApplication: vi.fn().mockImplementation(() => ({
            initialize: mockInitialize,
            handleRedirectPromise: mockHandleRedirectPromise,
            getActiveAccount: mockGetActiveAccount,
            getAllAccounts: mockGetAllAccounts,
            setActiveAccount: mockSetActiveAccount,
            acquireTokenSilent: mockAcquireTokenSilent,
            loginRedirect: mockLoginRedirect,
        })),
    }
})

function TestConsumer() {
    const { account, ready } = useAuth()
    return (
        <div>
            <span data-testid="auth-status">{ready ? 'ready' : 'loading'}</span>
            <span data-testid="user-name">{account?.name || 'none'}</span>
        </div>
    )
}

describe('AuthGate Microsoft SSO Redirect & Return Preservation', () => {
    const originalLocation = window.location

    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_AUTH_DISABLED', 'false')
        sessionStorage.clear()
        mockLoginRedirect.mockReset()
        mockHandleRedirectPromise.mockReset()
        mockGetActiveAccount.mockReset()
        mockGetAllAccounts.mockReset()
        mockSetActiveAccount.mockReset()
        mockAcquireTokenSilent.mockReset()

        // Mock window.location
        delete window.location
        window.location = {
            href: 'https://upload-canvas.example.com/structural-fire?handoff=test-uuid-456',
            origin: 'https://upload-canvas.example.com',
            pathname: '/structural-fire',
            search: '?handoff=test-uuid-456',
            hostname: 'upload-canvas.example.com',
            replace: vi.fn(),
        }
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        window.location = originalLocation
    })

    it('snapshots incoming handoff URL into sessionStorage and passes redirectStartPage to MSAL loginRedirect when signed out', async () => {
        mockHandleRedirectPromise.mockResolvedValue(null)
        mockGetActiveAccount.mockReturnValue(null)
        mockGetAllAccounts.mockReturnValue([])

        render(
            <AuthGate>
                <TestConsumer />
            </AuthGate>
        )

        await waitFor(() => {
            expect(mockLoginRedirect).toHaveBeenCalledTimes(1)
        })

        // Verify URL was snapshotted into sessionStorage
        expect(sessionStorage.getItem('auth_return_url')).toBe(
            'https://upload-canvas.example.com/structural-fire?handoff=test-uuid-456'
        )

        // Verify MSAL was instructed to return to the original start page
        const redirectArgs = mockLoginRedirect.mock.calls[0][0]
        expect(redirectArgs.redirectStartPage).toBe(
            'https://upload-canvas.example.com/structural-fire?handoff=test-uuid-456'
        )
    })

    it('restores return URL from sessionStorage when user returns from SSO redirect on origin', async () => {
        // User has logged in and Microsoft redirected to the origin:
        window.location.href = 'https://upload-canvas.example.com/'
        window.location.pathname = '/'
        window.location.search = ''

        sessionStorage.setItem(
            'auth_return_url',
            'https://upload-canvas.example.com/structural-fire?handoff=test-uuid-456'
        )

        const fakeAccount = {
            idTokenClaims: { oid: 'user-oid-1' },
            name: 'Ian Shaw',
            username: 'ian.shaw@firedynamicsgroup.com',
        }
        mockHandleRedirectPromise.mockResolvedValue({ idToken: 'fake-id-token' })
        mockGetActiveAccount.mockReturnValue(fakeAccount)

        render(
            <AuthGate>
                <TestConsumer />
            </AuthGate>
        )

        await waitFor(() => {
            expect(window.location.replace).toHaveBeenCalledWith(
                'https://upload-canvas.example.com/structural-fire?handoff=test-uuid-456'
            )
        })

        // auth_return_url must be cleared to prevent redirect loops
        expect(sessionStorage.getItem('auth_return_url')).toBeNull()
    })

    it('renders authenticated app and provides user account when signed in on target page', async () => {
        const fakeAccount = {
            idTokenClaims: { oid: 'user-oid-1' },
            name: 'Ian Shaw',
            username: 'ian.shaw@firedynamicsgroup.com',
        }
        mockHandleRedirectPromise.mockResolvedValue(null)
        mockGetActiveAccount.mockReturnValue(fakeAccount)

        render(
            <AuthGate>
                <TestConsumer />
            </AuthGate>
        )

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('ready')
            expect(screen.getByTestId('user-name')).toHaveTextContent('Ian Shaw')
        })

        expect(mockLoginRedirect).not.toHaveBeenCalled()
    })
})
