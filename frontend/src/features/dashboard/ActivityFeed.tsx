import { Link } from 'react-router-dom'
import { formatDate, formatDateTime } from '../../lib/format'
import { weekEndOf } from '../../lib/week'
import type { ActivityItem, ActivityType } from '../../types/api'

/**
 * Submissions and review actions in one reverse-chronological feed — the brief's "recent
 * activity, including recent review actions".
 *
 * The two kinds of event are merged by the backend, so this only has to phrase them. Each
 * line names the actor separately from the report's owner: for a submission they are the
 * same person, for a review they are not, and collapsing them would misattribute approvals.
 */
const STYLES: Record<ActivityType, { chip: string; icon: string; verb: string }> = {
  SUBMITTED: {
    chip: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
    icon: 'M12 19V5m0 0-6 6m6-6 6 6',
    verb: 'submitted',
  },
  APPROVED: {
    chip: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    icon: 'm5 12.5 4.5 4.5L19 7.5',
    verb: 'approved',
  },
  CHANGES_REQUESTED: {
    chip: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    icon: 'M12 8v5m0 3.5h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    verb: 'requested changes on',
  },
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-500">Nothing has happened yet.</p>
  }

  return (
    <ul className="divide-y divide-white/5">
      {items.map((item, index) => {
        const style = STYLES[item.type]
        const week = `${formatDate(item.weekStart)} – ${formatDate(weekEndOf(item.weekStart))}`
        const isSubmission = item.type === 'SUBMITTED'

        return (
          // Nothing in the feed is a stable identity — the same reviewer can act on the
          // same report twice — so the index is the key, and the list is never reordered
          // in place, only replaced wholesale by a fresh fetch.
          <li key={`${item.type}-${item.reportId}-${index}`} className="flex gap-3 px-4 py-3.5">
            <span
              aria-hidden="true"
              className={`grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset ${style.chip}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
              </svg>
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-300">
                <span className="font-medium text-ink-100">{item.actor.name}</span> {style.verb}{' '}
                {isSubmission ? (
                  'their report'
                ) : (
                  <span className="font-medium text-ink-100">{item.owner.name}&rsquo;s report</span>
                )}
                {item.versionNumber !== null && (
                  <span className="text-ink-500"> (v{item.versionNumber})</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                <Link to={`/reports/${item.reportId}`} className="hover:text-brand-300">
                  {week}
                </Link>{' '}
                · {item.projectName} · {formatDateTime(item.at)}
              </p>
              {item.comment && (
                <p className="mt-1.5 line-clamp-2 rounded-lg bg-navy-900/50 px-2.5 py-1.5 text-xs text-ink-300">
                  {item.comment}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
