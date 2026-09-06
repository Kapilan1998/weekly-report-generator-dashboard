import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { listTeamReports } from '../api/reports'
import { Alert } from '../components/Alert'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, formatWeek } from '../lib/format'
import type { PageResponse, ReportStatus, ReportSummary } from '../types/api'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: ReportStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DRAFT', label: 'Draft' },
]

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-200 ring-1 ring-brand-400/25">
      {initials(name)}
    </span>
  )
}

export function TeamDashboardPage() {
  const [status, setStatus] = useState<ReportStatus | 'ALL'>('ALL')
  const [pageNumber, setPageNumber] = useState(0)
  const [page, setPage] = useState<PageResponse<ReportSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    // Nothing is set synchronously here: `loading` starts true and the change handlers below
    // re-arm it, so this effect only touches state from its async callbacks.
    listTeamReports({
      page: pageNumber,
      size: PAGE_SIZE,
      status: status === 'ALL' ? undefined : [status],
    })
      .then((result) => {
        if (!active) return
        setPage(result)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? caught.message : 'Could not load reports.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [status, pageNumber])

  function handleStatusChange(next: ReportStatus | 'ALL') {
    setStatus(next)
    // Back to the first page: a narrower filter may not have the page you were on, which
    // would otherwise show an empty table.
    setPageNumber(0)
    setLoading(true)
  }

  function goToPage(next: number) {
    setPageNumber(next)
    setLoading(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="animate-fade-up">
      <PageHeader
        title="Team dashboard"
        description="Every team member's reports."
        actions={
          <label className="text-sm">
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => handleStatusChange(event.target.value as ReportStatus | 'ALL')}
              className="rounded-lg bg-navy-800 px-3.5 py-2.5 text-sm font-medium text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card>
        {loading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : page && page.content.length > 0 ? (
          <>
            {/* Desktop table */}
            <table className="hidden min-w-full divide-y divide-white/5 text-sm sm:table">
              <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Team member</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {page.content.map((report) => (
                  <tr key={report.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={report.owner.name} />
                        <span className="font-medium whitespace-nowrap text-ink-100">
                          {report.owner.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-ink-300">
                      {formatWeek(report.weekStart, report.weekEnd)}
                    </td>
                    <td className="px-4 py-3.5 text-ink-300">{report.project.name}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-ink-500">
                      {formatDateTime(report.lastSubmittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: stacked cards */}
            <ul className="divide-y divide-white/5 sm:hidden">
              {page.content.map((report) => (
                <li key={report.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={report.owner.name} />
                      <span className="truncate text-sm font-medium text-ink-100">
                        {report.owner.name}
                      </span>
                    </div>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-300">
                    {formatWeek(report.weekStart, report.weekEnd)} · {report.project.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Submitted {formatDateTime(report.lastSubmittedAt)}
                  </p>
                </li>
              ))}
            </ul>

            <Pagination
              page={page.page}
              size={page.size}
              totalElements={page.totalElements}
              totalPages={page.totalPages}
              first={page.first}
              last={page.last}
              onChange={goToPage}
            />
          </>
        ) : (
          !error && <EmptyState title="No reports match this filter" />
        )}
      </Card>
    </section>
  )
}
