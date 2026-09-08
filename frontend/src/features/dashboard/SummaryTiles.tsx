import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../../types/api'
import { formatWeek } from '../../lib/format'

/**
 * The brief's summary metrics for the selected week.
 *
 * Two of them — reports needing correction and open blockers — are current-state counts
 * across every week, not week-scoped, because "how many reports are waiting to be corrected"
 * is a question about now rather than about a particular week. The captions say so: a tile
 * sitting under a week picker that silently ignores it would be read wrong.
 */
function Tile({
  label,
  value,
  caption,
  tone = 'neutral',
  to,
}: {
  label: string
  value: string | number
  caption: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  to?: string
}) {
  const valueTone = {
    neutral: 'text-ink-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-red-300',
  }[tone]

  const body = (
    <>
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{caption}</p>
    </>
  )

  const shell =
    'block rounded-xl bg-navy-800 px-4 py-3.5 shadow-lg shadow-black/20 ring-1 ring-white/5'

  // Only the tiles that have somewhere useful to go become links, so a plain number is
  // never a dead click target.
  return to ? (
    <Link to={to} className={`${shell} transition hover:ring-white/15`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  )
}

export function SummaryTiles({ summary }: { summary: DashboardSummary }) {
  const week = formatWeek(summary.weekStart, summary.weekEnd)
  const accounted = summary.submitted + summary.draft + summary.notStarted
  // Guarded: teamSize can be 0 on an empty database, and the three parts can also drift
  // from teamSize (a member with a report in another state), so the bar is scaled by what
  // it actually shows rather than by the team size.
  const share = (count: number) => (accounted === 0 ? 0 : (count / accounted) * 100)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Submitted"
          value={`${summary.submitted} / ${summary.teamSize}`}
          caption={week}
          tone={summary.submitted === summary.teamSize && summary.teamSize > 0 ? 'good' : 'neutral'}
        />
        <Tile label="Still drafting" value={summary.draft} caption={week} />
        <Tile
          label="Needs correction"
          value={summary.needsCorrection}
          caption="All weeks, awaiting the author"
          tone={summary.needsCorrection > 0 ? 'warn' : 'neutral'}
          to="/team?status=NEEDS_CORRECTION"
        />
        <Tile
          label="Open blockers"
          value={summary.openBlockers}
          caption="All weeks, unapproved reports"
          tone={summary.openBlockers > 0 ? 'bad' : 'neutral'}
        />
      </div>

      <div className="rounded-xl bg-navy-800 px-4 py-3.5 shadow-lg shadow-black/20 ring-1 ring-white/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Submission compliance
          </p>
          <p className="text-sm font-semibold text-ink-100 tabular-nums">
            {summary.compliancePercent}%
            <span className="ml-2 text-xs font-normal text-ink-500">of the team filed</span>
          </p>
        </div>

        <div
          role="img"
          aria-label={`${summary.submitted} submitted, ${summary.draft} still drafting, ${summary.notStarted} not started`}
          className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-white/5"
        >
          <div style={{ width: `${share(summary.submitted)}%` }} className="bg-emerald-400 transition-[width] duration-500" />
          <div style={{ width: `${share(summary.draft)}%` }} className="bg-slate-400 transition-[width] duration-500" />
          <div style={{ width: `${share(summary.notStarted)}%` }} className="bg-white/10 transition-[width] duration-500" />
        </div>

        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-emerald-400" />
            Submitted {summary.submitted}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-slate-400" />
            Draft {summary.draft}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-white/10" />
            Not started {summary.notStarted}
          </li>
        </ul>
      </div>
    </div>
  )
}
