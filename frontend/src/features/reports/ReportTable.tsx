import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDateTime, formatWeek } from '../../lib/format'
import type { ReportSummary } from '../../types/api'

/**
 * The report list, shared by the team dashboard and a member's profile page so the two
 * cannot drift apart. Renders a table on desktop and stacked cards below `sm` — a
 * six-column table squeezed into 390px is unreadable however hard it scrolls.
 *
 * `currentUserId` decides whether a Review shortcut appears: a manager may not review their
 * own report (the backend refuses it), so offering the action on their own row would be a
 * link straight to a rejection.
 */
export function ReportTable({
  reports,
  showOwner = false,
  currentUserId,
  canReview = false,
}: {
  reports: ReportSummary[]
  showOwner?: boolean
  currentUserId?: number
  canReview?: boolean
}) {
  const navigate = useNavigate()

  function initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  }

  function reviewable(report: ReportSummary): boolean {
    return canReview && report.status === 'SUBMITTED' && report.owner.id !== currentUserId
  }

  /**
   * What the Action column offers for one row. Three outcomes, because "nothing to review"
   * and "nothing you may read" are different facts and an empty cell states neither — under
   * a header reading Action it just looks unfinished.
   *
   * - `review` — submitted, and not the manager's own: the decision is theirs to make.
   * - `open`   — already decided, or their own report. Nothing to review, but still readable,
   *              and a manager looking at an approved week usually wants to read it. "Open" is
   *              the same word the dashboard's week-status panel uses for this.
   * - `private` — somebody else's draft. Deliberately **not** a link: the backend refuses it
   *              until it is submitted, so a link would be a dead end. It says why instead.
   */
  function actionFor(report: ReportSummary): 'review' | 'open' | 'private' {
    if (reviewable(report)) return 'review'
    const isOwn = report.owner.id === currentUserId
    return report.status === 'DRAFT' && !isOwn ? 'private' : 'open'
  }

  return (
    <>
      <table className="hidden min-w-full divide-y divide-white/5 text-sm sm:table">
        <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
          <tr>
            {showOwner && <th className="px-4 py-3">Team member</th>}
            <th className="px-4 py-3">Week</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last submitted</th>
            {canReview && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {reports.map((report) => (
            <tr
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="cursor-pointer transition hover:bg-white/[0.03]"
            >
              {showOwner && (
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-200 ring-1 ring-brand-400/25">
                      {initials(report.owner.name)}
                    </span>
                    {/* Goes to the member, not the report — the row click covers that. */}
                    <Link
                      to={`/team/${report.owner.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium whitespace-nowrap text-ink-100 hover:text-brand-200"
                    >
                      {report.owner.name}
                    </Link>
                  </div>
                </td>
              )}
              <td className="px-4 py-3.5 whitespace-nowrap text-ink-300">
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
              {canReview && (
                <td className="px-4 py-3.5 text-right">
                  {actionFor(report) === 'review' ? (
                    <Link
                      to={`/review/${report.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition hover:bg-brand-500"
                    >
                      Review
                    </Link>
                  ) : actionFor(report) === 'open' ? (
                    <Link
                      to={`/reports/${report.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-brand-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-brand-200"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-xs whitespace-nowrap text-ink-500">
                      Private until submitted
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-white/5 sm:hidden">
        {reports.map((report) => (
          <li key={report.id} className="px-4 py-3.5">
            <Link to={`/reports/${report.id}`} className="block transition hover:opacity-90">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-ink-100">
                  {showOwner ? report.owner.name : formatWeek(report.weekStart, report.weekEnd)}
                </p>
                <StatusBadge status={report.status} />
              </div>
              <p className="mt-1 text-sm text-ink-300">
                {showOwner && `${formatWeek(report.weekStart, report.weekEnd)} · `}
                {report.project.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Submitted {formatDateTime(report.lastSubmittedAt)}
              </p>
            </Link>
            {/* No "Open" here: the whole card is already a link to the report, so it would
                be a second control for the same thing. Only the two facts the card cannot
                convey on its own are added. */}
            {canReview && actionFor(report) === 'review' && (
              <Link
                to={`/review/${report.id}`}
                className="mt-2.5 inline-flex items-center rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
              >
                Review
              </Link>
            )}
            {canReview && actionFor(report) === 'private' && (
              <p className="mt-2 text-xs text-ink-500">Private until submitted</p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
