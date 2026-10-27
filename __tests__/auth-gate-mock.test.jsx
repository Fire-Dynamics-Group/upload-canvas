// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import AuthGate from '../Components/auth/AuthGate'

describe('AuthGate mock bypass', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_DISABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not SSR the Microsoft sign-in wall when AUTH_DISABLED is set', () => {
    const html = renderToString(
      React.createElement(AuthGate, null, React.createElement('div', null, 'canvas-app'))
    )
    expect(html).not.toMatch(/Signing in with Microsoft/)
  })
})
