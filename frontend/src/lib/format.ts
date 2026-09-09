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

/**
 * A week in as few characters as stay unambiguous — "07 – 13 Sep 2026" rather than
 * "07 Sep 2026 – 13 Sep 2026". Written for the week picker's trigger, which is a form-width
 * control: the full form wraps to two lines there and stops looking like a single value.
 *
 * The month and year are repeated only when the week actually crosses one, so the label
 * never drops information to save space.
 */
export function formatWeekCompact(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'

  const day = (date: Date) => String(date.getDate()).padStart(2, '0')
  const month = (date: Date) => date.toLocaleDateString(undefined, { month: 'short' })

  if (start.getFullYear() !== end.getFullYear()) {
    return `${day(start)} ${month(start)} ${start.getFullYear()} – ${day(end)} ${month(end)} ${end.getFullYear()}`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${end.getFullYear()}`
  }
  return `${day(start)} – ${day(end)} ${month(end)} ${end.getFullYear()}`
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
