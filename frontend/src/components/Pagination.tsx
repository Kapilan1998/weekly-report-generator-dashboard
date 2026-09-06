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

/**
 * Footer bar for the paginated list endpoints. Page numbers are zero-based here because the
 * backend is (`spring.data.web.pageable.one-indexed-parameters=false`); only the label
 * shown to the user is +1.
 */
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

  const buttonClass =
    'rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-300'

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={first}
            className={buttonClass}
          >
            Previous
          </button>
          <span className="text-xs text-ink-500">
            Page <span className="font-medium text-ink-300">{page + 1}</span> of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={last}
            className={buttonClass}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  )
}
