import { request } from './client'
import type { AuthResponse } from '../types/api'

/**
 * The signed-in user's own account. Distinct from `api/users.ts`, which is manager-only and
 * administers other people's access — nothing here takes a user id, because the backend
 * always acts on whoever the token belongs to.
 */

export interface UpdateProfileInput {
  name: string
  email: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

/**
 * Both of these return a full AuthResponse, so the caller must pass it to `signIn` rather
 * than only reading the name off it. The JWT's subject is the user's email: after an email
 * change the token already held names a user that no longer exists, and the next request
 * would 401 and sign them out. Swapping in the returned token is what prevents that.
 */
export function updateProfile(input: UpdateProfileInput): Promise<AuthResponse> {
  return request<AuthResponse>('/profile', { method: 'PUT', body: input })
}

export function changePassword(input: ChangePasswordInput): Promise<AuthResponse> {
  return request<AuthResponse>('/profile/password', { method: 'PUT', body: input })
}
