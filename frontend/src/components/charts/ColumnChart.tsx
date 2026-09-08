/**
 * A vertical bar chart, drawn with CSS rather than SVG or a charting library.
 *
 * Why no library: the four datasets on this dashboard are all "a label and a number", and a
 * percentage-width/height div renders those exactly. A chart library would be the frontend's
 * largest dependency and the live-coding round asks about code in this repo, so the cost
 * outweighs what it would buy. It also keeps the charts genuinely responsive — bar sizes are
 * percentages of their container, and every label is real text at its real font size, which
 * a scaled SVG viewBox would shrink to nothing on a phone.
 */
export interface Column {
  /** Axis label under the bar. */
  label: string
  value: number
  /** Longer text for the native tooltip, e.g. the full week range. */
  title?: string
}

export function ColumnChart({
  data,
  ariaLabel,
  formatValue = (value: number) => String(value),
}: {
  data: Column[]
  ariaLabel: string
  formatValue?: (value: number) => string
}) {
  // Scaled against the tallest bar, so a quiet stretch of weeks still reads as a shape. A
  // floor of 1 keeps an all-zero dataset from dividing by zero.
  const max = Math.max(1, ...data.map((column) => column.value))

  return (
    <div role="img" aria-label={ariaLabel} className="flex items-end gap-1.5 sm:gap-2.5">
      {data.map((column) => {
        const heightPercent = (column.value / max) * 100
        return (
          <div key={column.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-medium text-ink-300">{formatValue(column.value)}</span>
            {/* Fixed-height track so every bar shares one baseline and one scale. */}
            <div className="flex h-28 w-full items-end sm:h-36">
              <div
                title={column.title ?? `${column.label}: ${formatValue(column.value)}`}
                style={{ height: `${heightPercent}%` }}
                // min-h keeps a zero bar visible as a baseline stub rather than vanishing.
                className="w-full min-h-0.5 rounded-t bg-gradient-to-t from-brand-700 to-brand-400 transition-[height] duration-500 ease-out"
              />
            </div>
            <span className="w-full truncate text-center text-[11px] text-ink-500">
              {column.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
