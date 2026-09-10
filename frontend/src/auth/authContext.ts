import { createContext } from 'react'
import type { AuthResponse, Role } from '../types/api'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
}

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isManager: boolean
  signIn: (response: AuthResponse) => void
  /**
   * `reason` is shown on the sign-in screen afterwards. Passed when the sign-out was not the
   * user's own choice - an expired token, or access changed by a manager.
   */
  signOut: (reason?: string) => void
}

export const AuthContext = createContext<AuthState | null>(null)
