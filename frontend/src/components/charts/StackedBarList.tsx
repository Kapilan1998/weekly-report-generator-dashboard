/**
 * One horizontal stacked bar per row, for a breakdown that has to be comparable across
 * rows — here, each team member's reports split by status.
 *
 * Segments are proportional to the row's own total, not to the largest row: the question
 * this answers is "what proportion of this member's reports are approved", so every row
 * fills the full track. The row total is printed alongside, which is what a shared scale
 * would otherwise have conveyed.
 */
export interface StackSegment {
  key: string
  label: string
  value: number
  /** Background utility class, kept in step with StatusBadge so colours mean one thing. */
  className: string
}

export interface Stack {
  key: string | number
  label: string
  segments: StackSegment[]
}

export function StackedBarList({
  data,
  legend,
  ariaLabel,
  emptyLabel = 'No reports',
}: {
  data: Stack[]
  legend: { label: string; className: string }[]
  ariaLabel: string
  emptyLabel?: string
}) {
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5 text-xs text-ink-500">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${entry.className}`} />
            {entry.label}
          </li>
        ))}
      </ul>

      <ul role="img" aria-label={ariaLabel} className="space-y-2.5">
        {data.map((stack) => {
          const total = stack.segments.reduce((sum, segment) => sum + segment.value, 0)
          return (
            <li key={stack.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-300" title={stack.label}>
                  {stack.label}
                </span>
                <span className="shrink-0 text-xs text-ink-500">
                  {total === 0 ? emptyLabel : `${total} report${total === 1 ? '' : 's'}`}
                </span>
              </div>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-white/5">
                {total > 0 &&
                  stack.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <div
                        key={segment.key}
                        title={`${segment.label}: ${segment.value}`}
                        style={{ width: `${(segment.value / total) * 100}%` }}
                        className={`h-full transition-[width] duration-500 ease-out ${segment.className}`}
                      />
                    ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
