import { formatWeek } from '../../lib/format'
import { mondayOf, weekEndOf } from '../../lib/week'

/**
 * Picks a week by picking any day in it.
 *
 * `<input type="week">` would be the obvious control, but it is still Chromium-only, and its
 * ISO week numbering is a second thing to reconcile with the backend. A date input plus the
 * same Monday normalisation the report form uses means whatever day the manager clicks, the
 * value that leaves here is the Monday the API expects — and the resolved range is printed
 * so the snap is visible rather than surprising.
 */
export function WeekPicker({
  value,
  onChange,
  label = 'Week',
}: {
  value: string
  onChange: (mondayIso: string) => void
  label?: string
}) {
  function shift(weeks: number) {
    const monday = new Date(`${value}T00:00:00`)
    if (Number.isNaN(monday.getTime())) return
    monday.setDate(monday.getDate() + weeks * 7)
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const day = String(monday.getDate()).padStart(2, '0')
    onChange(`${monday.getFullYear()}-${month}-${day}`)
  }

  const stepClass =
    'grid size-9 shrink-0 place-items-center rounded-lg text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-ink-100'

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous week" className={stepClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
          </svg>
        </button>

        <label className="min-w-0">
          <span className="sr-only">{label}</span>
          <input
            type="date"
            value={value}
            // Any day in the week resolves to its Monday, exactly as the backend would.
            onChange={(event) => onChange(mondayOf(event.target.value) || value)}
            className="w-40 rounded-lg bg-navy-800 px-3 py-2 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none"
          />
        </label>

        <button type="button" onClick={() => shift(1)} aria-label="Next week" className={stepClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8 5 5 5-5 5" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">{formatWeek(value, weekEndOf(value))}</p>
    </div>
  )
}
