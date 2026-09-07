import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { listMyReports } from '../api/reports'
import { Alert } from '../components/Alert'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, formatWeek } from '../lib/format'
import type { PageResponse, ReportSummary } from '../types/api'

const PAGE_SIZE = 20

export function MyReportsPage() {
  const navigate = useNavigate()
  const [pageNumber, setPageNumber] = useState(0)
  const [page, setPage] = useState<PageResponse<ReportSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    // `loading` starts true and the page-change handler re-arms it, so nothing is set
    // synchronously here.
    listMyReports({ page: pageNumber, size: PAGE_SIZE })
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
    // Guards against a state update after the component unmounts mid-request.
    return () => {
      active = false
    }
  }, [pageNumber])

  function goToPage(next: number) {
    setPageNumber(next)
    setLoading(true)
    // Otherwise the new page's first rows appear scrolled halfway down a long list.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="animate-fade-up">
      <PageHeader
        title="My reports"
        description="Your weekly reports and where each one stands."
        actions={
          <Link
            to="/reports/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 transition hover:bg-brand-500 active:scale-[0.98]"
          >
            + New report
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card>
        {loading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : page && page.content.length > 0 ? (
          <>
            {/* Desktop table */}
            <table className="hidden min-w-full divide-y divide-white/5 text-sm sm:table">
              <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {page.content.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => navigate(`/reports/${report.id}`)}
                    className="cursor-pointer transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3.5 font-medium whitespace-nowrap text-ink-100">
                      {/* The link carries the keyboard/screen-reader affordance; the row
                          click is a convenience on top of it. */}
                      <Link
                        to={`/reports/${report.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:text-brand-200"
                      >
                        {formatWeek(report.weekStart, report.weekEnd)}
                      </Link>
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

            {/* Mobile: stacked cards rather than a table squeezed into 390px */}
            <ul className="divide-y divide-white/5 sm:hidden">
              {page.content.map((report) => (
                <li key={report.id}>
                  <Link to={`/reports/${report.id}`} className="block px-4 py-3.5 transition hover:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-ink-100">
                        {formatWeek(report.weekStart, report.weekEnd)}
                      </p>
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-300">{report.project.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Submitted {formatDateTime(report.lastSubmittedAt)}
                    </p>
                  </Link>
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
          !error && (
            <EmptyState
              title="No reports yet"
              description="Start your first weekly report — it takes a couple of minutes."
              action={
                <Link
                  to="/reports/new"
                  className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
                >
                  + New report
                </Link>
              }
            />
          )
        )}
      </Card>
    </section>
  )
}
