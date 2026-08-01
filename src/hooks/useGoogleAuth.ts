import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { initGapiClient, setAccessToken, resetFolderCache } from '../lib/driveApi'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export function useGoogleAuth() {
  const { setAuth, clearAuth, isLoggedIn } = useAppStore()

  useEffect(() => {
    // 1. Initialize Google API Client (gapi)
    const initGapi = async () => {
      try {
        await initGapiClient(API_KEY)
      } catch (err) {
        console.error('GAPI init error:', err)
      }
    }

    if (typeof gapi !== 'undefined') {
      initGapi()
    }
  }, [])

  const login = () => {
    if (typeof google === 'undefined') {
      console.error('Google Identity Services not loaded')
      return
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
      callback: async (response) => {
        if (response.error) {
          console.error('Auth error:', response)
          return
        }

        const token = response.access_token
        setAccessToken(token)

        // Ambil info profile user untuk avatar & nama
        try {
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
          })
          const profile = await profileRes.json()

          setAuth(
            token,
            profile.name || 'Operator Teater',
            profile.picture || ''
          )
        } catch (err) {
          console.error('Fetch profile error:', err)
          setAuth(token, 'Operator Teater', '')
        }
      }
    })

    tokenClient.requestAccessToken()
  }

  const logout = () => {
    const token = useAppStore.getState().accessToken
    if (token) {
      google.accounts.oauth2.revoke(token, () => {
        // Callback setelah token dicabut
      })
    }
    clearAuth()
    resetFolderCache()
  }

  return { login, logout, isLoggedIn }
}
