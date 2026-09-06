interface PaginationProps {
  /** Zero-based, matching the backend. */
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
  onChange: (page: number) => void
}

type PageItem = number | 'gap'

/**
 * Which page numbers to render: always the first and last, plus a window around the
 * current page, with gaps collapsed to an ellipsis. Without this the control would grow a
 * button per page and overflow once the data set is any size.
 */
function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index)
  }

  const items: PageItem[] = [0]
  const start = Math.max(1, current - 1)
  const end = Math.min(total - 2, current + 1)

  if (start > 1) items.push('gap')
  for (let index = start; index <= end; index++) items.push(index)
  if (end < total - 2) items.push('gap')

  items.push(total - 1)
  return items
}

export function Pagination({
  page,
  size,
  totalElements,
  totalPages,
  first,
  last,
  onChange,
}: PaginationProps) {
  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  const stepClass =
    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-200 ring-1 ring-inset ring-orange-400/30 transition hover:bg-orange-500/15 hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-navy-700/30 px-4 py-2.5"
    >
      <p className="text-xs text-ink-500">
        Showing <span className="font-medium text-ink-300">{from}</span>–
        <span className="font-medium text-ink-300">{to}</span> of{' '}
        <span className="font-medium text-ink-300">{totalElements}</span>
      </p>

      {/* A single page needs no controls, but the count above is still useful. */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange(page - 1)} disabled={first} className={stepClass}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className="size-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {pageItems(page, totalPages).map((item, index) =>
              item === 'gap' ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="px-1 text-xs text-ink-500"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onChange(item)}
                  aria-label={`Go to page ${item + 1}`}
                  aria-current={item === page ? 'page' : undefined}
                  className={`grid size-8 place-items-center rounded-lg text-xs font-semibold transition ${
                    item === page
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-950/40'
                      : 'text-orange-200 ring-1 ring-inset ring-orange-400/30 hover:bg-orange-500/15 hover:text-orange-100'
                  }`}
                >
                  {item + 1}
                </button>
              ),
            )}
          </div>

          <button type="button" onClick={() => onChange(page + 1)} disabled={last} className={stepClass}>
            <span className="hidden sm:inline">Next</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className="size-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8 5 5 5-5 5" />
            </svg>
          </button>
        </div>
      )}
    </nav>
  )
}
