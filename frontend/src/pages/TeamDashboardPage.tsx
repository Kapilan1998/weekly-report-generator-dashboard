import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getActivity, getCharts, getSummary } from '../api/dashboard'
import { listAllProjects } from '../api/projects'
import { getWeekStatus, listTeamReports } from '../api/reports'
import { listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { Pagination } from '../components/Pagination'
import { ActivityFeed } from '../features/dashboard/ActivityFeed'
import { DashboardCharts } from '../features/dashboard/DashboardCharts'
import { ReportFilters } from '../features/dashboard/ReportFilters'
import { SummaryTiles } from '../features/dashboard/SummaryTiles'
import { WeekPicker } from '../features/dashboard/WeekPicker'
import { WeekStatusPanel } from '../features/dashboard/WeekStatusPanel'
import { EMPTY_FILTERS, isFiltered } from '../features/dashboard/reportFilterState'
import type { TeamReportFilterValue } from '../features/dashboard/reportFilterState'
import { ReportTable } from '../features/reports/ReportTable'
import { fresh, settled } from '../lib/keyed'
import type { Keyed } from '../lib/keyed'
import { formatDate } from '../lib/format'
import { currentMonday } from '../lib/week'
import type {
  ActivityItem,
  DashboardCharts as ChartsData,
  DashboardSummary,
  PageResponse,
  ProjectDetail,
  ReportStatus,
  ReportSummary,
  UserDetail,
  WeekStatus,
} from '../types/api'

const PAGE_SIZE = 10
const WEEK_WINDOWS = [4, 8, 12, 26]
const VALID_STATUSES: ReportStatus[] = ['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED']

/** Kept to the backend's own bounds (1–52), so a hand-edited URL can't produce a 400. */
function clampWeeks(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 8
  return Math.min(52, Math.round(value))
}

/** The two week-scoped panels come from one pair of requests, so they load as one unit. */
interface Overview {
  summary: DashboardSummary
  weekStatus: WeekStatus[]
}

/**
 * The manager dashboard: summary metrics and charts for one week, who has filed for it, a
 * recent-activity feed, and the filtered team report list.
 *
 * **Every control lives in the URL** rather than in component state. That makes a filtered
 * view shareable and the Back button meaningful, and it is what lets the "Needs correction"
 * summary tile be an ordinary link into this same page with the filter already applied.
 * Filter changes replace the history entry rather than pushing one, so Back leaves the
 * dashboard instead of walking back through every filter click.
 *
 * Each fetched result is stored with the parameters it was fetched for (see `lib/keyed.ts`),
 * so "still loading" is derived during render rather than by clearing state in the effect —
 * which matters here because the URL can also change from a link or the Back button, where
 * no event handler of ours runs.
 */
export function TeamDashboardPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // ---- the URL is the source of truth ----
  const week = searchParams.get('week') || currentMonday()
  const weeks = clampWeeks(Number(searchParams.get('weeks')))
  const page = Math.max(0, Number(searchParams.get('page')) || 0)

  const userIdParam = searchParams.get('userId')
  const projectIdParam = searchParams.get('projectId')
  const weekFrom = searchParams.get('weekFrom') ?? ''
  const weekTo = searchParams.get('weekTo') ?? ''
  const notStarted = searchParams.get('notStarted') === 'true'
  // Joined into one scalar so the fetch effect can depend on it: an array rebuilt on every
  // render would have a new identity each time and refetch forever.
  const statusKey = searchParams
    .getAll('status')
    .filter((value): value is ReportStatus => VALID_STATUSES.includes(value as ReportStatus))
    .join(',')

  const filters: TeamReportFilterValue = useMemo(
    () => ({
      userId: userIdParam ? Number(userIdParam) : 'ALL',
      projectId: projectIdParam ? Number(projectIdParam) : 'ALL',
      statuses: statusKey ? (statusKey.split(',') as ReportStatus[]) : [],
      notStarted,
      weekFrom,
      weekTo,
    }),
    [userIdParam, projectIdParam, statusKey, notStarted, weekFrom, weekTo],
  )

  const writeParams = useCallback(
    (next: Record<string, string | number | string[] | undefined>) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(next)) {
        params.delete(key)
        if (value === undefined || value === '') continue
        if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry))
        else params.set(key, String(value))
      }
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  function applyFilters(next: TeamReportFilterValue) {
    writeParams({
      userId: next.userId === 'ALL' ? undefined : next.userId,
      projectId: next.projectId === 'ALL' ? undefined : next.projectId,
      status: next.statuses,
      notStarted: next.notStarted ? 'true' : undefined,
      weekFrom: next.weekFrom,
      weekTo: next.weekTo,
      // Back to the first page: a narrower filter may not have the page you were on.
      page: undefined,
    })
  }

  // ---- data ----
  const [members, setMembers] = useState<UserDetail[]>([])
  const [projects, setProjects] = useState<ProjectDetail[]>([])
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [overview, setOverview] = useState<Keyed<Overview> | null>(null)
  const [charts, setCharts] = useState<Keyed<ChartsData> | null>(null)
  const [reports, setReports] = useState<Keyed<PageResponse<ReportSummary>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chartsKey = `${week}:${weeks}`
  const listKey = [page, userIdParam, projectIdParam, statusKey, weekFrom, weekTo].join('|')

  const overviewData = fresh(overview, week)
  const chartsData = fresh(charts, chartsKey)
  const reportsData = fresh(reports, listKey)

  // Reference data for the filter dropdowns, fetched once: it barely changes, and the
  // management pages reload it themselves after a write.
  useEffect(() => {
    let active = true
    Promise.all([listUsers(), listAllProjects()])
      .then(([userList, projectList]) => {
        if (!active) return
        setMembers(userList)
        setProjects(projectList)
      })
      .catch((caught: unknown) =>
        setError(errorMessage(caught, 'Could not load team members and projects.')),
      )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    getActivity(12)
      .then((items) => {
        if (active) setActivity(items)
      })
      .catch((caught: unknown) => setError(errorMessage(caught, 'Could not load recent activity.')))
    return () => {
      active = false
    }
  }, [])

  // The week overview. Both requests answer a question about the selected week only.
  useEffect(() => {
    let active = true
    Promise.all([getSummary(week), getWeekStatus(week)])
      .then(([summary, weekStatus]) => {
        if (active) setOverview({ key: week, data: { summary, weekStatus } })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load the weekly summary.'))
        setOverview({ key: week, data: null })
      })
    return () => {
      active = false
    }
  }, [week])

  useEffect(() => {
    let active = true
    getCharts(week, weeks)
      .then((result) => {
        if (active) setCharts({ key: `${week}:${weeks}`, data: result })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load the charts.'))
        setCharts({ key: `${week}:${weeks}`, data: null })
      })
    return () => {
      active = false
    }
  }, [week, weeks])

  useEffect(() => {
    let active = true
    const key = [page, userIdParam, projectIdParam, statusKey, weekFrom, weekTo].join('|')
    listTeamReports({
      page,
      size: PAGE_SIZE,
      userId: userIdParam ? Number(userIdParam) : undefined,
      projectId: projectIdParam ? Number(projectIdParam) : undefined,
      status: statusKey ? (statusKey.split(',') as ReportStatus[]) : undefined,
      weekFrom: weekFrom || undefined,
      weekTo: weekTo || undefined,
    })
      .then((result) => {
        if (active) setReports({ key, data: result })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load the report list.'))
        setReports({ key, data: null })
      })
    return () => {
      active = false
    }
  }, [page, userIdParam, projectIdParam, statusKey, weekFrom, weekTo])

  function goToPage(next: number) {
    writeParams({ page: next === 0 ? undefined : next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title="Team dashboard"
        description="Where the team stands this week, and every report in one place."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <WeekPicker value={week} onChange={(next) => writeParams({ week: next })} />
            <label>
              <span className="sr-only">Chart window</span>
              <select
                value={weeks}
                onChange={(event) => writeParams({ weeks: Number(event.target.value) })}
                className="rounded-lg bg-navy-800 px-3 py-2 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none"
              >
                {WEEK_WINDOWS.map((option) => (
                  <option key={option} value={option}>
                    Last {option} weeks
                  </option>
                ))}
              </select>
            </label>
            <Link
              to={`/team/sections?week=${week}`}
              className="rounded-lg bg-navy-800 px-3.5 py-2 text-sm font-medium text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20"
            >
              Compare sections
            </Link>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      {overviewData ? (
        <SummaryTiles summary={overviewData.summary} />
      ) : (
        !settled(overview, week) && <TilesSkeleton />
      )}

      {chartsData ? (
        <DashboardCharts charts={chartsData} weeks={weeks} />
      ) : (
        !settled(charts, chartsKey) && (
          <Card>
            <TableSkeleton rows={5} columns={2} />
          </Card>
        )
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="border-b border-white/5 bg-navy-700/30 px-4 py-3 text-sm font-semibold text-ink-100">
            Filed this week
          </h2>
          {overviewData ? (
            <WeekStatusPanel rows={overviewData.weekStatus} />
          ) : (
            !settled(overview, week) && <TableSkeleton rows={4} columns={2} />
          )}
        </Card>

        <Card>
          <h2 className="border-b border-white/5 bg-navy-700/30 px-4 py-3 text-sm font-semibold text-ink-100">
            Recent activity
          </h2>
          {activity ? <ActivityFeed items={activity} /> : <TableSkeleton rows={4} columns={2} />}
        </Card>
      </div>

      <ReportFilters
        value={filters}
        onChange={applyFilters}
        members={members}
        projects={projects}
      />

      <Card>
        {/* "Not started" is answered by a different query - see reportFilterState.ts - so it
            swaps the list rather than narrowing it. The rows are already in hand: the same
            week-status fetch feeds the "Filed this week" panel above. */}
        {filters.notStarted ? (
          <NotStartedList
            rows={overviewData?.weekStatus}
            week={week}
            userId={filters.userId}
            loading={!settled(overview, week)}
          />
        ) : reportsData === null ? (
          !settled(reports, listKey) && <TableSkeleton rows={4} columns={5} />
        ) : reportsData.content.length > 0 ? (
          <>
            <ReportTable
              reports={reportsData.content}
              showOwner
              canReview
              currentUserId={user?.id}
            />
            <Pagination
              page={reportsData.page}
              size={reportsData.size}
              totalElements={reportsData.totalElements}
              totalPages={reportsData.totalPages}
              first={reportsData.first}
              last={reportsData.last}
              onChange={goToPage}
            />
          </>
        ) : (
          <EmptyState
            title={isFiltered(filters) ? 'No reports match these filters' : 'No reports yet'}
            description={
              isFiltered(filters)
                ? 'Try widening the range or clearing a filter.'
                : 'Reports appear here as soon as the team starts filing them.'
            }
            action={
              isFiltered(filters) && (
                <button
                  type="button"
                  onClick={() => applyFilters(EMPTY_FILTERS)}
                  className="text-sm font-medium text-brand-300 hover:text-brand-200"
                >
                  Clear filters
                </button>
              )
            }
          />
        )}
      </Card>
    </section>
  )
}

/**
 * Members with no report for the selected week — the brief's fifth status filter.
 *
 * Only the member filter carries over. A report that was never filed has no project and no
 * submission date, so filtering this list by project or by a week range would be filtering
 * on fields that don't exist; the header says which week it is about instead.
 */
function NotStartedList({
  rows,
  week,
  userId,
  loading,
}: {
  rows: WeekStatus[] | undefined
  week: string
  userId: number | 'ALL'
  loading: boolean
}) {
  if (loading || !rows) {
    return <TableSkeleton rows={4} columns={2} />
  }

  const missing = rows.filter(
    (row) => row.status === null && (userId === 'ALL' || row.member.id === userId),
  )

  return (
    <>
      <div className="border-b border-white/5 bg-navy-700/30 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-100">
          Not started — week of {formatDate(week)}
        </h2>
        <p className="mt-0.5 text-xs text-ink-500">
          No report row exists for these members, so the project and date-range filters
          don&apos;t apply here.
        </p>
      </div>
      {missing.length === 0 ? (
        <EmptyState
          title="Everyone has filed for this week"
          description="Nobody is missing a report for the selected week."
        />
      ) : (
        <WeekStatusPanel rows={missing} />
      )}
    </>
  )
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl bg-navy-800 ring-1 ring-white/5"
          style={{ animationDelay: `${index * 80}ms` }}
        />
      ))}
    </div>
  )
}
