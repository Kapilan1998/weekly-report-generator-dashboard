import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import type { WeekStatus } from '../../types/api'

/**
 * Who has filed for the selected week and who hasn't.
 *
 * This is the one view that shows the brief's fifth status, "not yet started" — the absence
 * of a report row, which cannot be a value of `status` and so cannot come out of the report
 * list. `GET /api/reports/week-status` exists for exactly this: it starts from the user list
 * rather than the report list, so a member with nothing filed still gets a row.
 */
export function WeekStatusPanel({ rows }: { rows: WeekStatus[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-500">No team members yet.</p>
  }

  return (
    <ul className="divide-y divide-white/5">
      {rows.map((row) => (
        <li key={row.member.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            to={`/team/${row.member.id}`}
            className="min-w-0 truncate text-sm font-medium text-ink-100 transition hover:text-brand-200"
          >
            {row.member.name}
          </Link>

          <div className="flex shrink-0 items-center gap-2.5">
            <StatusBadge status={row.status} />
            {/* A draft belonging to someone else is deliberately unreadable, so there is
                nothing to link to until it has been submitted. */}
            {row.reportId !== null && row.status !== 'DRAFT' && (
              <Link
                to={`/reports/${row.reportId}`}
                className="text-xs font-medium whitespace-nowrap text-brand-300 transition hover:text-brand-200"
              >
                Open
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
