import type { ReactNode } from 'react'

/** A raised navy surface, one step lighter than the page behind it. */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-navy-800 shadow-lg shadow-black/20 ring-1 ring-white/5 ${className}`}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-300">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Placeholder rows while a table loads, so the layout doesn't jump when data arrives. */
export function TableSkeleton({ rows = 3, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="h-4 flex-1 animate-pulse rounded bg-white/5"
              style={{ animationDelay: `${rowIndex * 90}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mx-auto grid size-11 place-items-center rounded-full bg-white/5 text-ink-500 ring-1 ring-white/5"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="size-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"
          />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-ink-100">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-300">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
