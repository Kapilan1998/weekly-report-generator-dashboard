import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, errorMessage } from '../api/client'
import { deleteReport, listMyReports } from '../api/reports'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, formatWeek } from '../lib/format'
import type { PageResponse, ReportSummary } from '../types/api'

const PAGE_SIZE = 20

/**
 * Only a draft can be selected, because only a draft can be deleted.
 *
 * A draft is private working notes — nobody else has ever seen it and no manager has acted on
 * it. Everything past that point belongs to the review record: a submitted report may carry
 * an approval or a correction request and a version history a manager can still open, and
 * removing it would erase a decision made about the author's work. The backend refuses it
 * with a 409, so following this app's rule that the UI doesn't offer what the backend
 * refuses, those rows have no checkbox at all rather than a checkbox that fails.
 */
function isDeletable(report: ReportSummary): boolean {
  return report.status === 'DRAFT'
}

export function MyReportsPage() {
  const navigate = useNavigate()
  const [pageNumber, setPageNumber] = useState(0)
  const [page, setPage] = useState<PageResponse<ReportSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  /** Ids of the drafts ticked for deletion, and whether a delete is in flight. */
  const [selected, setSelected] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

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
  }, [pageNumber, reload])

  function goToPage(next: number) {
    setPageNumber(next)
    setLoading(true)
    // A selection is per page: the ids on screen are about to be replaced, and carrying
    // ticks across pages would mean deleting rows the user can no longer see.
    setSelected([])
    setConfirming(false)
    // Otherwise the new page's first rows appear scrolled halfway down a long list.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const drafts = page?.content.filter(isDeletable) ?? []
  const allDraftsSelected = drafts.length > 0 && selected.length === drafts.length

  function toggle(id: number) {
    setConfirming(false)
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  function toggleAll() {
    setConfirming(false)
    setSelected(allDraftsSelected ? [] : drafts.map((report) => report.id))
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    setNotice(null)

    /*
     * One request per draft, run together. There is no bulk endpoint and a member has at most
     * one report per week, so the count here is small — a bulk endpoint would be a new
     * transaction boundary and a new partial-failure contract to design for no practical
     * gain at this size.
     *
     * allSettled rather than all: if one delete fails the others have still happened, and
     * reporting "none of it worked" would be a lie the refreshed list immediately contradicts.
     */
    const results = await Promise.allSettled(selected.map((id) => deleteReport(id)))
    const failed = results.filter((result) => result.status === 'rejected')
    const deleted = results.length - failed.length

    if (deleted > 0) {
      setNotice(`Deleted ${deleted} draft${deleted === 1 ? '' : 's'}.`)
    }
    if (failed.length > 0) {
      const first = failed[0] as PromiseRejectedResult
      setError(
        `${failed.length} of ${results.length} could not be deleted. ${errorMessage(first.reason, '')}`.trim(),
      )
    }

    setSelected([])
    setConfirming(false)
    setDeleting(false)
    // Refetch rather than splicing the rows out locally: the page's totals and which rows
    // belong on this page both change, and the server is the one that knows.
    setReload((current) => current + 1)
  }

  const checkboxClass =
    'size-4 shrink-0 cursor-pointer rounded accent-brand-500 disabled:cursor-not-allowed'

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

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <Card>
        {/* The selection bar only exists while something is ticked, so the page looks exactly
            as it did before when nothing is selected. */}
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-navy-700/40 px-4 py-3">
            <p className="text-sm text-ink-100">
              <span className="font-semibold">{selected.length}</span> draft
              {selected.length === 1 ? '' : 's'} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete selected
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected([])
                  setConfirming(false)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : page && page.content.length > 0 ? (
          <>
            {/* Desktop table */}
            <table className="hidden min-w-full divide-y divide-white/5 text-sm sm:table">
              <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="w-10 px-4 py-3">
                    {/* Select-all covers the drafts on this page only, and is absent when
                        there are none — a checkbox that can never tick anything is noise. */}
                    {drafts.length > 0 ? (
                      <input
                        type="checkbox"
                        checked={allDraftsSelected}
                        onChange={toggleAll}
                        disabled={deleting}
                        aria-label={
                          allDraftsSelected
                            ? 'Clear selection'
                            : `Select all ${drafts.length} drafts on this page`
                        }
                        className={checkboxClass}
                      />
                    ) : (
                      <span className="sr-only">Select</span>
                    )}
                  </th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {page.content.map((report) => {
                  const deletable = isDeletable(report)
                  const checked = selected.includes(report.id)
                  return (
                    <tr
                      key={report.id}
                      onClick={() => navigate(`/reports/${report.id}`)}
                      className={`cursor-pointer transition hover:bg-white/[0.03] ${
                        checked ? 'bg-brand-500/10' : ''
                      }`}
                    >
                      {/* stopPropagation on the cell, not just the input: the row navigates on
                          click, and ticking a box must not also open the report. */}
                      <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                        {deletable ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(report.id)}
                            disabled={deleting}
                            aria-label={`Select draft for ${formatWeek(report.weekStart, report.weekEnd)}`}
                            className={checkboxClass}
                          />
                        ) : (
                          <span
                            title="Only a draft can be deleted"
                            aria-label="Not deletable"
                            className="block size-4 rounded ring-1 ring-inset ring-white/10"
                          />
                        )}
                      </td>
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
                  )
                })}
              </tbody>
            </table>

            {/* Mobile: stacked cards rather than a table squeezed into 390px */}
            <ul className="divide-y divide-white/5 sm:hidden">
              {drafts.length > 0 && (
                <li className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allDraftsSelected}
                    onChange={toggleAll}
                    disabled={deleting}
                    aria-label={`Select all ${drafts.length} drafts on this page`}
                    className={checkboxClass}
                  />
                  <span className="text-xs text-ink-500">
                    Select all {drafts.length} draft{drafts.length === 1 ? '' : 's'}
                  </span>
                </li>
              )}
              {page.content.map((report) => {
                const deletable = isDeletable(report)
                const checked = selected.includes(report.id)
                return (
                  <li
                    key={report.id}
                    className={`flex items-start gap-3 px-4 py-3.5 ${checked ? 'bg-brand-500/10' : ''}`}
                  >
                    {deletable ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(report.id)}
                        disabled={deleting}
                        aria-label={`Select draft for ${formatWeek(report.weekStart, report.weekEnd)}`}
                        className={`${checkboxClass} mt-0.5`}
                      />
                    ) : (
                      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    )}
                    <Link to={`/reports/${report.id}`} className="min-w-0 flex-1">
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
                )
              })}
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

      {/*
        Asked before anything is deleted, and only ever from the Delete button.

        `selected.length > 0` is part of the condition, not just `confirming`. A successful
        delete clears the selection and lowers this flag in the same update, and if the two
        ever got out of step the dialog would appear over an empty selection asking to
        "Delete 0 drafts?" - which is exactly what happened. Tying it to there being something
        to delete makes that state unreachable.
      */}
      <ConfirmDialog
        open={confirming && selected.length > 0}
        title={`Delete ${selected.length} draft${selected.length === 1 ? '' : 's'}?`}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="No"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      >
        {selected.length === 1
          ? 'This draft and everything in it will be removed. This cannot be undone.'
          : `These ${selected.length} drafts and everything in them will be removed. This cannot be undone.`}
      </ConfirmDialog>
    </section>
  )
}
