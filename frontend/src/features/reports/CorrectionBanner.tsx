import type { ReactNode } from 'react'
import { formatDateTime } from '../../lib/format'
import type { ReviewComment } from '../../types/api'

/**
 * The manager's review decision, shown to the report's author.
 *
 * The brief requires the team member to "see the manager's comment clearly on their report
 * page", so this is deliberately the loudest block on the screen: the comment renders larger
 * than body text, is never truncated, and is attributed — reviewer, timestamp, and which
 * version it was made against, which is also what makes "which version a given comment was
 * made against" visible.
 *
 * One component serves the detail page and the edit form so the wording can't drift, and the
 * approved variant so an approval reads as a decision rather than an absence of one.
 */
interface CorrectionBannerProps {
  comment: ReviewComment
  tone: 'correction' | 'approved'
  /** On the form the instruction is what you work against, so it loses the action button. */
  variant?: 'detail' | 'form'
  action?: ReactNode
}

const TONES = {
  correction: {
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/10',
    heading: 'text-amber-200',
    meta: 'text-amber-200/70',
    quote: 'border-amber-400/50',
    iconBg: 'bg-amber-400/15 text-amber-300',
  },
  approved: {
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/10',
    heading: 'text-emerald-200',
    meta: 'text-emerald-200/70',
    quote: 'border-emerald-400/50',
    iconBg: 'bg-emerald-400/15 text-emerald-300',
  },
}

export function CorrectionBanner({
  comment,
  tone,
  variant = 'detail',
  action,
}: CorrectionBannerProps) {
  const styles = TONES[tone]
  const isCorrection = tone === 'correction'

  const heading = isCorrection
    ? variant === 'form'
      ? `Changes requested by ${comment.reviewer.name} — address these before resubmitting`
      : `Changes requested by ${comment.reviewer.name}`
    : `Approved by ${comment.reviewer.name}`

  return (
    <section
      aria-labelledby="review-decision-heading"
      className={`rounded-xl p-4 ring-1 ring-inset sm:p-5 ${styles.bg} ${styles.ring}`}
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-full ${styles.iconBg}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="size-4.5">
            {isCorrection ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 3.5h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
            )}
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <h2 id="review-decision-heading" className={`text-sm font-semibold ${styles.heading}`}>
            {heading}
          </h2>

          {/* Optional on approval, required on a change request - hence the guard. */}
          {comment.comment && (
            <blockquote
              className={`mt-2.5 rounded-lg border-l-2 bg-navy-900/40 px-3.5 py-3 text-base leading-relaxed break-words whitespace-pre-wrap text-ink-100 ${styles.quote}`}
            >
              {comment.comment}
            </blockquote>
          )}

          <p className={`mt-2.5 text-xs ${styles.meta}`}>
            {isCorrection ? 'Reviewed' : 'Approved'} version {comment.versionNumber} ·{' '}
            {formatDateTime(comment.createdAt)}
          </p>

          {action && <div className="mt-3.5">{action}</div>}
        </div>
      </div>
    </section>
  )
}
