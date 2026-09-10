import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setAuthToken, setUnauthorizedHandler } from '../api/client'
import { rememberSignOutReason } from './signOutReason'
import type { AuthResponse } from '../types/api'
import { AuthContext } from './authContext'
import type { AuthUser } from './authContext'

const STORAGE_KEY = 'wrg.auth'

interface StoredAuth {
  token: string
  user: AuthUser
}

function readStored(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed?.token || !parsed?.user?.role) return null
    return parsed
  } catch {
    // Private browsing, cleared storage, or a stale shape from an older build.
    return null
  }
}

/**
 * Read once at module load, before React renders. Doing it here rather than in an effect
 * means the first render already knows whether the user is signed in, so a refresh on a
 * protected page never flashes the login screen or a loading state.
 */
const restored = readStored()
if (restored) {
  setAuthToken(restored.token)
}

/**
 * Holds the signed-in user and keeps the API client's token in sync.
 *
 * The token is persisted in localStorage so a refresh doesn't sign the user out. That is a
 * deliberate trade-off for this assignment: an httpOnly cookie would be less exposed to
 * XSS, but it needs CSRF handling and a same-site deployment, which the stateless-JWT
 * design was chosen to avoid. Noted as a future improvement.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(restored?.user ?? null)

  const signOut = useCallback((reason?: string) => {
    setAuthToken(null)
    setUser(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do - the in-memory token is already gone, which is what matters.
    }
    // Outside the try: storing the reason has its own failure handling, and losing it must
    // not depend on whether clearing localStorage happened to throw first.
    rememberSignOutReason(reason)
  }, [])

  const signIn = useCallback((response: AuthResponse) => {
    const nextUser: AuthUser = {
      id: response.userId,
      name: response.name,
      email: response.email,
      role: response.role,
    }
    setAuthToken(response.token)
    setUser(nextUser)
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: response.token, user: nextUser }),
      )
    } catch {
      // Session still works for this tab; it just won't survive a refresh.
    }
  }, [])

  // Any 401 - including a token that expired mid-session - drops straight back to signed out.
  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isManager: user?.role === 'MANAGER',
      signIn,
      signOut,
    }),
    [user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
