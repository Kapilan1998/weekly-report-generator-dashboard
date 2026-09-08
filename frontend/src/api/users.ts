import { request } from './client'
import type { CreateUserInput, UpdateUserInput, UserDetail } from '../types/api'

/** All of this is manager-only on the backend, at the controller class level. */

export function listUsers(): Promise<UserDetail[]> {
  return request<UserDetail[]>('/users')
}

/**
 * Creates an account with an initial password. This is the one endpoint that accepts a
 * role — self-registration always produces a team member.
 */
export function createUser(input: CreateUserInput): Promise<UserDetail> {
  return request<UserDetail>('/users', { method: 'POST', body: input })
}

/** Role assignment and enable/disable. Refused for your own account. */
export function updateUser(id: number, input: UpdateUserInput): Promise<UserDetail> {
  return request<UserDetail>(`/users/${id}`, { method: 'PUT', body: input })
}

/** Only for an account with no reports; otherwise 409 pointing at disabling instead. */
export function deleteUser(id: number): Promise<void> {
  return request<void>(`/users/${id}`, { method: 'DELETE' })
}
