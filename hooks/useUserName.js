import { useAuth } from '../lib/auth/AuthContext'

export default function useUserName() {
  const { account, ready } = useAuth()
  return {
    userName: account?.name || null,
    userId: account?.oid || null,
    needsName: !ready,
  }
}
