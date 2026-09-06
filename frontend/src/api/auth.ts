import { request } from './client'
import type { AuthResponse } from '../types/api'

export interface LoginInput {
  email: string
  password: string
}

/**
 * No role field: the backend always creates a TEAM_MEMBER on self-registration, and sending
 * one would be rejected as an unknown property.
 */
export interface RegisterInput {
  name: string
  email: string
  password: string
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: input })
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: input })
}
