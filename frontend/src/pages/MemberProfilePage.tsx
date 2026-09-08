import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listTeamReports } from '../api/reports'
import { listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { Pagination } from '../components/Pagination'
import { StackedBarList } from '../components/charts/StackedBarList'
import { ReportTable } from '../features/reports/ReportTable'
import { formatDate, formatDateTime } from '../lib/format'
import { fresh, settled } from '../lib/keyed'
import type { Keyed } from '../lib/keyed'
import type { PageResponse, ReportStatus, ReportSummary, UserDetail } from '../types/api'

const PAGE_SIZE = 10

const STATUSES: { key: ReportStatus; label: string; className: string; text: string }[] = [
  { key: 'APPROVED', label: 'Approved', className: 'bg-emerald-400', text: 'text-emerald-300' },
  { key: 'SUBMITTED', label: 'Submitted', className: 'bg-sky-400', text: 'text-sky-300' },
  {
    key: 'NEEDS_CORRECTION',
    label: 'Needs correction',
    className: 'bg-amber-400',
    text: 'text-amber-300',
  },
  { key: 'DRAFT', label: 'Draft', className: 'bg-slate-400', text: 'text-ink-300' },
]

interface MemberOverview {
  /** `null` when no account has this id — a deleted member, or a hand-typed URL. */
  member: UserDetail | null
  counts: Record<ReportStatus, number>
}

/**
 * One team member, seen by a manager: who they are, how their reports break down by status,
 * and their full history.
 *
 * The status counts come from four one-row list queries reading `totalElements` rather than
 * from fetching every report and counting client-side. That keeps the numbers exact however
 * much history exists — a `size=200` fetch would silently under-count the day someone passes
 * 200 reports — and the dashboard's own `statusByMember` chart can't stand in, because it is
 * scoped to that chart's week window rather than to all time.
 *
 * There is no single-user endpoint, so identity comes from the manager-only user list: one
 * extra request rather than one extra endpoint, reading the same data the user management
 * page already does.
 */
export function MemberProfilePage() {
  const { userId: userIdParam } = useParams<{ userId: string }>()
  const memberId = Number(userIdParam)
  const { user: currentUser } = useAuth()

  const [pageNumber, setPageNumber] = useState(0)
  const [overview, setOverview] = useState<Keyed<MemberOverview> | null>(null)
  const [reports, setReports] = useState<Keyed<PageResponse<ReportSummary>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keyed by the parameters each fetch used, so staleness is derived during render rather
  // than by clearing state from inside the effect — see lib/keyed.ts.
  const overviewKey = String(memberId)
  const listKey = `${memberId}:${pageNumber}`
  const overviewData = fresh(overview, overviewKey)
  const reportsData = fresh(reports, listKey)

  useEffect(() => {
    let active = true
    const key = String(memberId)

    Promise.all([
      listUsers(),
      ...STATUSES.map((status) =>
        // size=1 because only totalElements is wanted; the row itself is discarded.
        listTeamReports({ userId: memberId, status: [status.key], size: 1 }),
      ),
    ])
      .then(([userList, ...pages]) => {
        if (!active) return
        setOverview({
          key,
          data: {
            member: userList.find((entry) => entry.id === memberId) ?? null,
            counts: STATUSES.reduce(
              (accumulator, status, index) => {
                accumulator[status.key] = pages[index].totalElements
                return accumulator
              },
              {} as Record<ReportStatus, number>,
            ),
          },
        })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load this member.'))
        setOverview({ key, data: null })
      })

    return () => {
      active = false
    }
  }, [memberId])

  useEffect(() => {
    let active = true
    const key = `${memberId}:${pageNumber}`
    listTeamReports({ userId: memberId, page: pageNumber, size: PAGE_SIZE })
      .then((result) => {
        if (active) setReports({ key, data: result })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load reports.'))
        setReports({ key, data: null })
      })
    return () => {
      active = false
    }
  }, [memberId, pageNumber])

  if (!settled(overview, overviewKey)) {
    return <p className="text-sm text-ink-500">Loading…</p>
  }

  if (overviewData === null) {
    return <Alert>{error ?? 'Could not load this member.'}</Alert>
  }

  if (overviewData.member === null) {
    return (
      <Card>
        <EmptyState
          title="Team member not found"
          description="The account may have been deleted."
          action={
            <Link to="/team" className="text-sm font-medium text-brand-300 hover:text-brand-200">
              Back to team dashboard
            </Link>
          }
        />
      </Card>
    )
  }

  const member = overviewData.member
  const counts = overviewData.counts
  const total = STATUSES.reduce((sum, status) => sum + (counts[status.key] ?? 0), 0)
  // The newest row on page 0, which the default sort (week descending) puts first.
  const latest = pageNumber === 0 ? reportsData?.content[0] : undefined

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title={member.name}
        description={`${member.email} · ${roleLabel(member)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!member.enabled && (
              <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/25">
                Account disabled
              </span>
            )}
            <Link
              to="/team"
              className="rounded-lg bg-navy-700 px-3.5 py-2.5 text-sm font-medium text-ink-100 ring-1 ring-inset ring-white/10 transition hover:bg-navy-600"
            >
              Back to dashboard
            </Link>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reports filed" value={total} caption="All time" />
        {STATUSES.slice(0, 3).map((status) => (
          <Stat
            key={status.key}
            label={status.label}
            value={counts[status.key] ?? 0}
            caption={captionFor(status.key)}
            tone={status.text}
          />
        ))}
      </div>

      <Card>
        <h2 className="border-b border-white/5 bg-navy-700/30 px-4 py-3 text-sm font-semibold text-ink-100">
          At a glance
        </h2>

        <div className="space-y-4 px-4 py-4">
          {total > 0 && (
            <StackedBarList
              ariaLabel={`${member.name} reports by status`}
              legend={STATUSES}
              data={[
                {
                  key: memberId,
                  label: 'All reports',
                  segments: STATUSES.map((status) => ({
                    key: status.key,
                    label: status.label,
                    value: counts[status.key] ?? 0,
                    className: status.className,
                  })),
                },
              ]}
            />
          )}

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Joined" value={formatDate(member.createdAt)} />
            <Row
              label="Most recent week"
              value={latest ? formatDate(latest.weekStart) : 'Nothing filed yet'}
            />
            <Row
              label="Last submitted"
              value={latest ? formatDateTime(latest.lastSubmittedAt) : '—'}
            />
            <Row label="Role" value={roleLabel(member)} />
          </dl>
        </div>
      </Card>

      <Card>
        {reportsData === null ? (
          !settled(reports, listKey) && <TableSkeleton rows={4} columns={4} />
        ) : reportsData.content.length > 0 ? (
          <>
            <ReportTable reports={reportsData.content} canReview currentUserId={currentUser?.id} />
            <Pagination
              page={reportsData.page}
              size={reportsData.size}
              totalElements={reportsData.totalElements}
              totalPages={reportsData.totalPages}
              first={reportsData.first}
              last={reportsData.last}
              onChange={(next) => {
                setPageNumber(next)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </>
        ) : (
          <EmptyState
            title="No reports yet"
            description="Nothing has been filed against this account."
          />
        )}
      </Card>
    </section>
  )
}

function roleLabel(member: UserDetail): string {
  return member.role === 'MANAGER' ? 'Manager' : 'Team member'
}

/** Says which of these counts are current-state rather than historical. */
function captionFor(status: ReportStatus): string {
  if (status === 'SUBMITTED') return 'Awaiting review now'
  if (status === 'NEEDS_CORRECTION') return 'Awaiting the author now'
  return 'All time'
}

function Stat({
  label,
  value,
  caption,
  tone = 'text-ink-100',
}: {
  label: string
  value: number
  caption: string
  tone?: string
}) {
  return (
    <div className="rounded-xl bg-navy-800 px-4 py-3.5 shadow-lg shadow-black/20 ring-1 ring-white/5">
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{caption}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-1.5 sm:border-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-100">{value}</dd>
    </div>
  )
}
