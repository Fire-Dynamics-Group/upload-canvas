import { describe, it, expect } from 'vitest'
import { resolveApiBase } from '../Components/ApiCalls'

describe('resolveApiBase', () => {
  it('uses NEXT_PUBLIC_API_URL when it is set', () => {
    expect(resolveApiBase({
      NEXT_PUBLIC_API_URL: 'https://api.example.test',
      NODE_ENV: 'production',
    })).toBe('https://api.example.test')
  })

  it('uses the existing server url for a production build when the env url is unset', () => {
    const base = resolveApiBase({ NODE_ENV: 'production' })
    expect(base).toBe('https://backendfornextapp-production.up.railway.app')
    expect(base).not.toContain('127.0.0.1')
  })

  it('keeps localhost for local dev when the env url is unset', () => {
    expect(resolveApiBase({ NODE_ENV: 'development' })).toBe('http://127.0.0.1:8001')
    expect(resolveApiBase({ NODE_ENV: 'test', NEXT_PUBLIC_API_URL: '' })).toBe('http://127.0.0.1:8001')
  })
})
