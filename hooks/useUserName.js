import { useState, useEffect } from 'react'

const STORAGE_KEY = 'upload-canvas-username'

export default function useUserName() {
  const [userName, setUserNameState] = useState(null)
  const [needsName, setNeedsName] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (stored) {
      setUserNameState(stored)
      setNeedsName(false)
    } else {
      setNeedsName(true)
    }
  }, [])

  const setUserName = (name) => {
    localStorage.setItem(STORAGE_KEY, name)
    setUserNameState(name)
    setNeedsName(false)
  }

  const clearName = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUserNameState(null)
    setNeedsName(true)
  }

  return { userName, setUserName, needsName, clearName }
}
