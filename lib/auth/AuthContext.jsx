import { createContext, useContext } from 'react'

export const MOCK_USER = { oid: 'dev-user', name: 'Dev', username: 'dev@firedynamicsgroup.com' }

export const AuthContext = createContext({ account: null, ready: false })

export const useAuth = () => useContext(AuthContext)
