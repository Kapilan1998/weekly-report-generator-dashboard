/** Backend dates are ISO strings; these render them without pulling in a date library. */

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatWeek(weekStart: string, weekEnd: string): string {
  return `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
}

/** Compact axis label for a week, e.g. "06 Oct". */
export function formatDayMonth(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

/**
 * Hours come from a BigDecimal(6,2), so they arrive as e.g. 26 or 26.5. Trailing zeros are
 * dropped — "26h" reads better than "26.00h" in a chart label.
 */
export function formatHours(value: number): string {
  const hours = Number(value)
  if (!Number.isFinite(hours)) return '0h'
  return `${Number(hours.toFixed(2))}h`
}

/** "Development" from "DEVELOPMENT", for enum values rendered as labels. */
export function humanizeEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
