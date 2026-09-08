/** A horizontal bar per row — the readable shape when labels are names, not dates. */
export interface Bar {
  key: string | number
  label: string
  value: number
  /** Rendered to the right of the label, e.g. a report count next to an hours bar. */
  meta?: string
}

export function BarList({
  data,
  ariaLabel,
  formatValue = (value: number) => String(value),
  tone = 'brand',
}: {
  data: Bar[]
  ariaLabel: string
  formatValue?: (value: number) => string
  tone?: 'brand' | 'emerald' | 'orange'
}) {
  const max = Math.max(1, ...data.map((bar) => bar.value))
  const fill = {
    brand: 'from-brand-700 to-brand-400',
    emerald: 'from-emerald-700 to-emerald-400',
    orange: 'from-orange-700 to-orange-400',
  }[tone]

  return (
    <ul role="img" aria-label={ariaLabel} className="space-y-2.5">
      {data.map((bar) => (
        <li key={bar.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-300" title={bar.label}>
              {bar.label}
            </span>
            <span className="shrink-0 text-xs text-ink-500">
              {bar.meta && <span className="mr-2">{bar.meta}</span>}
              <span className="font-medium text-ink-100">{formatValue(bar.value)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              style={{ width: `${(bar.value / max) * 100}%` }}
              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out ${fill}`}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
