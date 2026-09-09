/**
 * Week helpers. These mirror `ReportService.normalizeToMonday` on the backend, which pins
 * any date to the Monday of its ISO week and sets weekEnd to that Monday + 6 days.
 *
 * Duplicated deliberately: `CreateReportInput` accepts only `weekStart`, and there is no
 * endpoint that normalizes a week without also creating a report — so the form has to show
 * the user which week they are about to file before it posts anything. If the backend rule
 * changes, change it here too.
 */

/**
 * Parses a yyyy-MM-dd value without timezone drift.
 *
 * Exported so `WeekField`'s calendar builds its grid with the same parser rather than a
 * second one. `new Date(iso)` is the trap this avoids, and a calendar that lands a day out
 * west of Greenwich is exactly the bug worth not writing twice.
 */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  // Constructed in local time; `new Date('2026-03-04')` would parse as UTC and can land on
  // the previous day west of Greenwich.
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The Monday of the week containing this date, as yyyy-MM-dd. Returns '' if unparseable. */
export function mondayOf(isoDate: string): string {
  const date = parseIsoDate(isoDate)
  if (!date) return ''
  // getDay(): 0 = Sunday, so Sunday belongs to the week that started six days earlier.
  const dayOfWeek = date.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  date.setDate(date.getDate() - daysSinceMonday)
  return toIsoDate(date)
}

/** The Sunday closing the week that starts on this Monday. */
export function weekEndOf(mondayIso: string): string {
  const date = parseIsoDate(mondayIso)
  if (!date) return ''
  date.setDate(date.getDate() + 6)
  return toIsoDate(date)
}

/** The Monday of the current week, for defaulting a new report. */
export function currentMonday(): string {
  return mondayOf(toIsoDate(new Date()))
}

/** Any date shifted by whole days, in and out as yyyy-MM-dd. '' if unparseable. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Whole months, clamped by the Date API the same way a calendar's month nav should be. */
export function addMonthsIso(isoDate: string, months: number): string {
  const date = parseIsoDate(isoDate)
  if (!date) return ''
  // Set the day to the 1st first: stepping from the 31st into a 30-day month would
  // otherwise roll forward into the month after the one asked for.
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toIsoDate(date)
}

/** Today, as yyyy-MM-dd in the viewer's own timezone. */
export function todayIso(): string {
  return toIsoDate(new Date())
}
