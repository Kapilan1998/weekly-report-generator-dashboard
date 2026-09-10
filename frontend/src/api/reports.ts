import { request } from './client'
import type {
  CreateReportInput,
  PageResponse,
  ReportContentInput,
  ReportDetail,
  ReportFilters,
  ReportSummary,
  ReportVersionDetail,
  ReportVersionSummary,
  WeekStatus,
} from '../types/api'

function toQuery(filters: ReportFilters) {
  return {
    userId: filters.userId,
    projectId: filters.projectId,
    status: filters.status,
    weekStart: filters.weekStart,
    weekFrom: filters.weekFrom,
    weekTo: filters.weekTo,
    page: filters.page,
    size: filters.size,
    sort: filters.sort,
  }
}

export function createReport(input: CreateReportInput): Promise<ReportDetail> {
  return request<ReportDetail>('/reports', { method: 'POST', body: input })
}

export function updateReport(id: number, input: ReportContentInput): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}`, { method: 'PUT', body: input })
}

export function submitReport(id: number): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}/submit`, { method: 'POST' })
}

/** Own history. Any userId in the filters is ignored — the endpoint has no such parameter. */
export function listMyReports(filters: ReportFilters = {}): Promise<PageResponse<ReportSummary>> {
  const { userId: _ignored, ...rest } = filters
  return request<PageResponse<ReportSummary>>('/reports/mine', { query: toQuery(rest) })
}

/** Manager only. */
export function listTeamReports(filters: ReportFilters = {}): Promise<PageResponse<ReportSummary>> {
  return request<PageResponse<ReportSummary>>('/reports', { query: toQuery(filters) })
}

export function getReport(id: number): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}`)
}

export function listVersions(id: number): Promise<ReportVersionSummary[]> {
  return request<ReportVersionSummary[]>(`/reports/${id}/versions`)
}

export function getVersion(id: number, versionNumber: number): Promise<ReportVersionDetail> {
  return request<ReportVersionDetail>(`/reports/${id}/versions/${versionNumber}`)
}

/**
 * Deletes one of your own drafts. 409 for anything already submitted — a submitted report is
 * part of the review record, so the backend refuses and the UI does not offer it.
 */
export function deleteReport(id: number): Promise<void> {
  return request<void>(`/reports/${id}`, { method: 'DELETE' })
}

/** Manager only. Includes members with no report for the week. */
export function getWeekStatus(weekStart: string): Promise<WeekStatus[]> {
  return request<WeekStatus[]>('/reports/week-status', { query: { weekStart } })
}

/** Manager only. */
export function approveReport(id: number, comment?: string): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}/approve`, {
    method: 'POST',
    body: { comment: comment ?? null },
  })
}

/** Manager only. The comment is required by the backend. */
export function requestChanges(id: number, comment: string): Promise<ReportDetail> {
  return request<ReportDetail>(`/reports/${id}/request-changes`, {
    method: 'POST',
    body: { comment },
  })
}
