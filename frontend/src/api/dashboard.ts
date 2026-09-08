import { request } from './client'
import type { ActivityItem, DashboardCharts, DashboardSummary } from '../types/api'

/** Manager only — every one of these reads across the whole team. */

export function getSummary(weekStart: string): Promise<DashboardSummary> {
  return request<DashboardSummary>('/dashboard/summary', { query: { weekStart } })
}

/** The window ends at `weekStart` and reaches `weeks` back. Backend bounds: 1–52. */
export function getCharts(weekStart: string, weeks = 8): Promise<DashboardCharts> {
  return request<DashboardCharts>('/dashboard/charts', { query: { weekStart, weeks } })
}

/** Submissions and review actions in one feed, newest first. Backend bounds: 1–50. */
export function getActivity(limit = 15): Promise<ActivityItem[]> {
  return request<ActivityItem[]>('/dashboard/activity', { query: { limit } })
}
