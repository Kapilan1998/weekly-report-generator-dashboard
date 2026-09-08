import { request } from './client'
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
  UpdateProjectInput,
} from '../types/api'

/** Active projects, for the report form's project tag. Readable by anyone signed in. */
export function listProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/projects')
}

/** Manager only. Includes inactive projects and each project's report count. */
export function listAllProjects(): Promise<ProjectDetail[]> {
  return request<ProjectDetail[]>('/projects/all')
}

export function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  return request<ProjectDetail>('/projects', { method: 'POST', body: input })
}

export function updateProject(id: number, input: UpdateProjectInput): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${id}`, { method: 'PUT', body: input })
}

/** 409 with the report count if anything references it — deactivate instead. */
export function deleteProject(id: number): Promise<void> {
  return request<void>(`/projects/${id}`, { method: 'DELETE' })
}
