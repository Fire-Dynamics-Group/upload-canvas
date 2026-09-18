import { describe, expect, it } from 'vitest'
import { isOwnedByCurrentUser } from '../Components/ProjectDashboard'

describe('isOwnedByCurrentUser', () => {
  it('matches new SSO projects by Entra object id', () => {
    expect(isOwnedByCurrentUser({ created_by: 'entra-oid' }, 'entra-oid', 'Ian Shaw')).toBe(true)
  })

  it('matches legacy projects by the creator first name', () => {
    expect(isOwnedByCurrentUser({ created_by: 'Ian' }, 'entra-oid', 'Ian Shaw')).toBe(true)
  })

  it('does not assign another person’s legacy project', () => {
    expect(isOwnedByCurrentUser({ created_by: 'Kirsty' }, 'entra-oid', 'Ian Shaw')).toBe(false)
  })
})
