import type { ReportStatus } from '../../types/api'

/**
 * The filter values behind the team report list, kept out of the component file so that one
 * only exports a component (which is what React Fast Refresh needs to reload it in place).
 */
export interface TeamReportFilterValue {
  userId: number | 'ALL'
  projectId: number | 'ALL'
  statuses: ReportStatus[]
  /**
   * The brief lists "not started" alongside the four real statuses. It isn't one: it is the
   * absence of a report row for the selected week, so it cannot be a value of `status` and
   * the report list cannot return it — a row that doesn't exist has nothing to filter.
   *
   * So it is a separate flag, and turning it on swaps the list for the roster of members who
   * haven't filed for the selected week (from `GET /api/reports/week-status`, which starts
   * from the user list rather than the report list). Mutually exclusive with the status
   * chips for the same reason: the two answers come from different queries and can't be
   * unioned into one page.
   */
  notStarted: boolean
  weekFrom: string
  weekTo: string
}

export const EMPTY_FILTERS: TeamReportFilterValue = {
  userId: 'ALL',
  projectId: 'ALL',
  statuses: [],
  notStarted: false,
  weekFrom: '',
  weekTo: '',
}

/** Drives the "Clear filters" affordance and the wording of the empty state. */
export function isFiltered(value: TeamReportFilterValue): boolean {
  return (
    value.userId !== 'ALL' ||
    value.projectId !== 'ALL' ||
    value.statuses.length > 0 ||
    value.notStarted ||
    value.weekFrom !== '' ||
    value.weekTo !== ''
  )
}
