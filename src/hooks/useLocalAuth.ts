import { useAppStore } from '../store/useAppStore'

const CORRECT_PIN = '1234'

export function useLocalAuth() {
  const { isLoggedIn, setLoggedIn, stopAllTracks } = useAppStore()

  const loginWithPIN = (pin: string): boolean => {
    if (pin === CORRECT_PIN) {
      setLoggedIn(true)
      return true
    }
    return false
  }

  const logout = () => {
    stopAllTracks()
    setLoggedIn(false)
  }

  return {
    loginWithPIN,
    logout,
    isLoggedIn
  }
}
