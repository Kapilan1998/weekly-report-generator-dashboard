import { request } from './client'
import type { ProjectSummary } from '../types/api'

/** Active projects, for the report form's project tag. Full CRUD lands in Phase 3. */
export function listProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/projects')
}
