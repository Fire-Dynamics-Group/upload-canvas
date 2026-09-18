import { useEffect, useState } from 'react'
import { AuthContext, MOCK_USER } from '../../lib/auth/AuthContext'
import { authority, apiScope, entraConfig, identityScopes } from '../../lib/auth/config'
import { setTokenProvider } from '../../lib/auth/token'

const canUseMockAuth = () => {
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'true') return false
  if (typeof window === 'undefined') return false
  const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return local || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'preview'
}

function MockProvider({ children }) {
  useEffect(() => {
    setTokenProvider(async () => null)
    return () => setTokenProvider(async () => null)
  }, [])
  return <AuthContext.Provider value={{ account: MOCK_USER, ready: true }}>{children}</AuthContext.Provider>
}

function MicrosoftProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const signIn = async () => {
      const { PublicClientApplication } = await import('@azure/msal-browser')
      const client = new PublicClientApplication({
        auth: { clientId: entraConfig.clientId, authority, redirectUri: window.location.origin },
        cache: { cacheLocation: 'sessionStorage' },
      })
      await client.initialize()
      const redirectResult = await client.handleRedirectPromise()
      const signedIn = client.getActiveAccount() || client.getAllAccounts()[0]
      if (!signedIn) {
        await client.loginRedirect({ scopes: apiScope ? [apiScope] : identityScopes })
        return
      }
      client.setActiveAccount(signedIn)
      if (cancelled) return
      setTokenProvider(async () => {
        if (apiScope) {
          const result = await client.acquireTokenSilent({ account: signedIn, scopes: [apiScope] })
          return result.accessToken
        }
        if (redirectResult?.idToken) return redirectResult.idToken
        const result = await client.acquireTokenSilent({ account: signedIn, scopes: identityScopes })
        return result.idToken
      })
      setAccount({
        oid: signedIn.idTokenClaims?.oid,
        name: signedIn.name || signedIn.username,
        username: signedIn.username,
      })
    }
    signIn().catch((reason) => !cancelled && setError(reason))
    return () => {
      cancelled = true
      setTokenProvider(async () => null)
    }
  }, [])

  if (error) {
    return <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6"><p>Microsoft sign-in could not be completed. {error.message}</p></main>
  }
  if (!account) return <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Signing in with Microsoft…</main>
  return <AuthContext.Provider value={{ account, ready: true }}>{children}</AuthContext.Provider>
}

export default function AuthGate({ children }) {
  return canUseMockAuth() ? <MockProvider>{children}</MockProvider> : <MicrosoftProvider>{children}</MicrosoftProvider>
}
